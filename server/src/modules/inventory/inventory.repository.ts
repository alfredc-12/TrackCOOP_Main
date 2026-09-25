import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { storageProvider } from "../../storage";
import { AppError } from "../../utils/app-error";
import type { InventoryProduct, InventoryProductInput, InventoryStockInput } from "./inventory.types";
import { validateProductInput } from "./inventory-validation";

type InventoryProductRow = RowDataPacket & {
  id: number | string;
  name: string;
  category: string | null;
  price: number | string;
  cost_price: number | string | null;
  description: string | null;
  unit: string | null;
  stock: number | string | null;
  pending_qty: number | string | null;
  sold: number | string | null;
  status: string;
  img: string | null;
  reorder_level: number | string | null;
};

type InventoryMovementRow = RowDataPacket & {
  product_id: number | string;
  type: string;
  amount: number | string;
  date: string | Date;
};

type InventoryHistoryRow = RowDataPacket & {
  id: number | string;
  amount: number | string;
  date: string | Date;
  product_name: string;
  unit: string | null;
  img: string | null;
};

export type ListInventoryProductsOptions = {
  includeHistory?: boolean;
  publicOnly?: boolean;
};

function mapProductStatus(status: string) {
  if (status === "Active") return "Available";
  if (status === "Out of Stock") return "Unavailable";
  return status;
}

async function processAndSaveImage(base64Str: string, category = "inventory") {
  if (!base64Str) {
    return base64Str;
  }

  if (!base64Str.startsWith("data:image/")) {
    if (/^(https?:\/\/|\/)/.test(base64Str)) return base64Str;
    throw new AppError("Invalid image path.", 400, "INVALID_IMAGE_PATH");
  }

  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new AppError("Invalid image data.", 400, "INVALID_IMAGE_DATA");

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  if (!["png", "jpg", "gif", "webp"].includes(ext)) {
    throw new AppError("Unsupported image type.", 400, "INVALID_IMAGE_TYPE");
  }
  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.length > 700 * 1024) {
    throw new AppError("Image must be 700 KB or smaller.", 400, "IMAGE_TOO_LARGE");
  }
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const isGif = buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a");
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const validSignature = ext === "png" ? isPng : ext === "jpg" ? isJpeg : ext === "gif" ? isGif : isWebp;
  if (!validSignature) {
    throw new AppError("Image content does not match its declared type.", 400, "INVALID_IMAGE_CONTENT");
  }
  const filename = `product-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const stored = await storageProvider().put({
    key: `${category}/${filename}`,
    visibility: "public",
    body: buffer,
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
  });

  return stored.url ?? stored.path;
}

export interface InventoryRepository {
  listProducts(options?: ListInventoryProductsOptions): Promise<InventoryProduct[]>;
  createProduct(input: InventoryProductInput, userId: string): Promise<number>;
  updateProduct(productId: string, input: InventoryProductInput, userId: string): Promise<void>;
  archiveProduct(productId: string, userId: string): Promise<boolean>;
  updateStock(productId: string, input: InventoryStockInput, userId: string): Promise<void>;
  listHistory(): Promise<Array<{
    id: number | string;
    type: "add" | "deduct";
    amount: number;
    date: string | Date;
    inventoryItem: { name: string; unit: string | null; img: string | null };
  }>>;
}

export function createInventoryRepository(pool?: Pool): InventoryRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async listProducts({ includeHistory = false, publicOnly = false }: ListInventoryProductsOptions = {}) {
      const [rows] = await databasePool().execute<InventoryProductRow[]>(`
        SELECT
          p.product_id as id,
          p.product_name as name,
          p.category,
          p.selling_price as price,
          p.cost_price,
          p.description,
          p.unit,
          COALESCE(v.quantity_on_hand, 0) as stock,
          (
              SELECT COALESCE(SUM(psi.quantity), 0)
              FROM pos_sale_items psi
              JOIN pos_sales ps ON ps.pos_sale_id = psi.pos_sale_id
              WHERE ps.sale_status = 'Pending Payment' AND psi.product_id = p.product_id
          ) as pending_qty,
          (
              SELECT COALESCE(SUM(psi.quantity), 0)
              FROM pos_sale_items psi
              JOIN pos_sales ps ON ps.pos_sale_id = psi.pos_sale_id
              WHERE ps.sale_status IN ('Paid', 'Completed') AND psi.product_id = p.product_id
          ) as sold,
          p.product_status as status,
          p.image_path as img,
          p.reorder_level
        FROM products p
        LEFT JOIN v_product_inventory_balance v ON p.product_id = v.product_id
        WHERE p.product_status <> 'Archived'
        ORDER BY p.product_name ASC
      `);

      let movementsByProduct = new Map<number, InventoryProduct["history"]>();

      if (includeHistory && rows.length > 0) {
        const productIds = rows.map((row) => Number(row.id));
        const placeholders = productIds.map(() => "?").join(", ");
        const [movements] = await databasePool().execute<InventoryMovementRow[]>(`
          SELECT
            product_id,
            movement_type as type,
            quantity_change as amount,
            movement_date as date
          FROM inventory_movements
          WHERE product_id IN (${placeholders})
          ORDER BY movement_date DESC
        `, productIds);

        movementsByProduct = movements.reduce((map, movement) => {
          const productId = Number(movement.product_id);
          const history = map.get(productId) ?? [];

          history.push({
            type: Number(movement.amount) > 0 ? "add" : "deduct",
            amount: Math.abs(Number(movement.amount)),
            date: movement.date,
          });

          map.set(productId, history);
          return map;
        }, new Map<number, InventoryProduct["history"]>());
      }

      const inventory = rows.map<InventoryProduct>((item) => {
        const id = Number(item.id);
        const stock = Number(item.stock ?? 0);
        const pendingQty = Number(item.pending_qty ?? 0);

        return {
          id,
          name: item.name,
          category: item.category ?? "Uncategorized",
          price: Number(item.price),
          cost_price: publicOnly ? 0 : Number(item.cost_price ?? 0),
          description: item.description ?? "",
          unit: item.unit ?? "piece",
          stock,
          pending_qty: pendingQty,
          sold: Number(item.sold ?? 0),
          status: mapProductStatus(item.status),
          img: item.img ?? "",
          reorder_level: Number(item.reorder_level ?? 0),
          ...(includeHistory ? { history: movementsByProduct.get(id) ?? [] } : {}),
        };
      });

      if (!publicOnly) {
        return inventory;
      }

      return inventory.filter((item) => item.status === "Available" && item.stock - item.pending_qty > 0);
    },

    async createProduct(input, userId) {
      const product = validateProductInput(input, true);
      const imagePath = await processAndSaveImage(input.img ?? "");
      const sku = `SKU-${randomUUID()}`;

      return withTransaction(async (connection) => {
        const [productResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO products
             (sku, product_name, category, unit, selling_price, cost_price, description, product_status, image_path, created_by, reorder_level)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sku,
            product.name,
            product.category,
            product.productUnit,
            product.sellingPrice,
            product.costPrice,
            product.description,
            product.dbStatus,
            imagePath || null,
            userId,
            product.reorderLevel,
          ],
        );

        const productId = productResult.insertId;

        if (product.openingStock > 0) {
          await connection.execute(
            `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by)
             VALUES (?, 'Opening Stock', ?, ?)`,
            [productId, product.openingStock, userId],
          );
        }

        return productId;
      }, databasePool());
    },

    async updateProduct(productId, input, userId) {
      const product = validateProductInput(input);
      const imagePath = await processAndSaveImage(input.img ?? "");
      await withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<Array<RowDataPacket & { product_status: string; image_path: string | null }>>(
          "SELECT product_status, image_path FROM products WHERE product_id = ? FOR UPDATE",
          [productId],
        );
        if (!existingRows[0]) throw new AppError("Product not found.", 404, "PRODUCT_NOT_FOUND");
        const status = input.status === undefined ? existingRows[0].product_status : product.dbStatus;
        const nextImagePath = input.img === undefined || input.img === ""
          ? existingRows[0].image_path
          : imagePath;

        await connection.execute(
          `UPDATE products
              SET product_name = ?, category = ?, unit = ?, selling_price = ?, cost_price = ?,
                  description = ?, product_status = ?, reorder_level = ?, image_path = ?
            WHERE product_id = ?`,
          [product.name, product.category, product.productUnit, product.sellingPrice, product.costPrice,
            product.description, status, product.reorderLevel, nextImagePath || null, productId],
        );

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'inventory.product.updated', 'products', ?, 'Inventory product details were updated.', ?, ?)`,
          [userId, productId,
            JSON.stringify({ productStatus: existingRows[0].product_status, imagePath: existingRows[0].image_path }),
            JSON.stringify({ productStatus: status, imagePath: nextImagePath })],
        );
      }, databasePool());
    },

    async archiveProduct(productId, userId) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          "UPDATE products SET product_status = 'Archived' WHERE product_id = ? AND product_status <> 'Archived'",
          [productId],
        );

        if (result.affectedRows > 0) {
          await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'inventory.product.archived', 'products', ?, 'Inventory product was archived.')`,
          [userId, productId],
          );
        }
        return result.affectedRows > 0;
      }, databasePool());
    },

    async updateStock(productId, input, userId) {
      if (input.amount === undefined || input.amount === null || input.amount === "") {
        throw new AppError("Invalid amount", 400, "INVALID_STOCK_AMOUNT");
      }

      const qty = Number(input.amount);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError("Stock amount must be greater than zero.", 400, "INVALID_STOCK_AMOUNT");
      }
      let movementType = "Adjustment";
      let quantityChange = 0;

      if (input.type === "add") {
        movementType = "Stock In";
        quantityChange = Math.abs(qty);
      } else if (input.type === "deduct") {
        movementType = "Sale";
        quantityChange = -Math.abs(qty);
      } else {
        throw new AppError("Invalid operation type", 400, "INVALID_STOCK_OPERATION");
      }

      await withTransaction(async (connection: PoolConnection) => {
        const [products] = await connection.execute<Array<RowDataPacket & { unit: string | null; product_status: string }>>(
          `SELECT unit, product_status FROM products WHERE product_id = ? FOR UPDATE`,
          [productId],
        );
        const productRow = products[0];
        if (!productRow) throw new AppError("Product not found.", 404, "PRODUCT_NOT_FOUND");
        if (productRow.product_status === "Archived") {
          throw new AppError("Archived products cannot receive stock changes.", 409, "ARCHIVED_PRODUCT");
        }
        const wholeNumberUnits = new Set(["piece", "sack", "bag", "bundle", "box", "bottle", "can", "tray", "crate", "roll", "set", "unit"]);
        if (wholeNumberUnits.has((productRow.unit || "piece").toLowerCase()) && !Number.isInteger(qty)) {
          throw new AppError("This unit only accepts whole-number quantities.", 400, "FRACTIONAL_STOCK_NOT_ALLOWED");
        }

        const [movements] = await connection.execute<Array<RowDataPacket & { quantity_change: number | string }>>(
          `SELECT quantity_change
             FROM inventory_movements
            WHERE product_id = ?
            FOR UPDATE`,
          [productId],
        );

        const currentStock = movements.reduce((total, movement) => total + Number(movement.quantity_change), 0);
        if (quantityChange < 0 && currentStock < Math.abs(quantityChange)) {
          throw new AppError("Stock deduction exceeds available quantity.", 409, "INSUFFICIENT_STOCK");
        }

        await connection.execute(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by)
           VALUES (?, ?, ?, ?)`,
          [productId, movementType, quantityChange, userId],
        );
      }, databasePool());
    },

    async listHistory() {
      const [rows] = await databasePool().execute<InventoryHistoryRow[]>(`
        SELECT
          m.inventory_movement_id as id,
          m.quantity_change as amount,
          m.movement_date as date,
          p.product_name,
          p.unit,
          p.image_path as img
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.product_id
        ORDER BY m.movement_date DESC
        LIMIT 100
      `);

      return rows.map((log) => ({
        id: log.id,
        type: Number(log.amount) > 0 ? "add" : "deduct",
        amount: Math.abs(Number(log.amount)),
        date: log.date,
        inventoryItem: {
          name: log.product_name,
          unit: log.unit,
          img: log.img,
        },
      }));
    },
  };
}
