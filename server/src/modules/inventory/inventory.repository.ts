import { promises as fs } from "node:fs";
import path from "node:path";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { InventoryProduct, InventoryProductInput, InventoryStockInput } from "./inventory.types";

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

type InventoryBalanceRow = RowDataPacket & {
  stock: number | string | null;
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
  if (!base64Str || !base64Str.startsWith("data:image/")) {
    return base64Str;
  }

  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Str;
  }

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");
  const filename = `product-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", category);

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  return `/uploads/${category}/${filename}`;
}

function validateProductInput(input: InventoryProductInput, requireStock = false) {
  const sellingPrice = Number(input.price);
  const costPrice = Number(input.cost_price ?? 0);
  const openingStock = Number(input.stock ?? 0);
  const reorderLevel = Number(input.reorder_level ?? 0);
  const productUnit = input.unit?.trim() || "piece";

  if (
    !input.name ||
    !productUnit ||
    !Number.isFinite(sellingPrice) ||
    sellingPrice < 0 ||
    (requireStock && (!Number.isFinite(openingStock) || openingStock < 0))
  ) {
    throw new AppError(
      requireStock
        ? "Product name, unit, price, and stock are required."
        : "Product name, unit, and valid price are required.",
      400,
      "INVALID_PRODUCT_INPUT",
    );
  }

  return {
    name: input.name,
    category: input.category ?? null,
    sellingPrice,
    costPrice,
    description: input.description ?? null,
    productUnit,
    openingStock,
    reorderLevel,
    dbStatus: input.status === "Available" ? "Active" : "Out of Stock",
  };
}

export interface InventoryRepository {
  listProducts(options?: ListInventoryProductsOptions): Promise<InventoryProduct[]>;
  createProduct(input: InventoryProductInput, userId: string): Promise<number>;
  updateProduct(productId: string, input: InventoryProductInput): Promise<void>;
  archiveProduct(productId: string): Promise<boolean>;
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
          0 as sold,
          p.product_status as status,
          p.image_path as img,
          p.reorder_level
        FROM products p
        LEFT JOIN v_product_inventory_balance v ON p.product_id = v.product_id
        WHERE p.product_status <> 'Archived'
        ORDER BY p.product_name ASC
      `);

      let movementsByProduct = new Map<number, InventoryProduct["history"]>();

      if (includeHistory) {
        const [movements] = await databasePool().execute<InventoryMovementRow[]>(`
          SELECT
            product_id,
            movement_type as type,
            quantity_change as amount,
            movement_date as date
          FROM inventory_movements
          ORDER BY movement_date DESC
        `);

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
      const sku = `SKU-${Date.now()}`;

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

    async updateProduct(productId, input) {
      const product = validateProductInput(input);
      const imagePath = await processAndSaveImage(input.img ?? "");

      await databasePool().execute(
        `UPDATE products
            SET product_name = ?,
                category = ?,
                unit = ?,
                selling_price = ?,
                cost_price = ?,
                description = ?,
                product_status = ?,
                reorder_level = ?,
                image_path = ?
          WHERE product_id = ?`,
        [
          product.name,
          product.category,
          product.productUnit,
          product.sellingPrice,
          product.costPrice,
          product.description,
          product.dbStatus,
          product.reorderLevel,
          imagePath || null,
          productId,
        ],
      );
    },

    async archiveProduct(productId) {
      const [result] = await databasePool().execute<ResultSetHeader>(
        "UPDATE products SET product_status = 'Archived' WHERE product_id = ?",
        [productId],
      );

      return result.affectedRows > 0;
    },

    async updateStock(productId, input, userId) {
      if (!input.amount || Number.isNaN(Number(input.amount))) {
        throw new AppError("Invalid amount", 400, "INVALID_STOCK_AMOUNT");
      }

      const qty = Number(input.amount);
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
        const [balances] = await connection.execute<InventoryBalanceRow[]>(
          `SELECT COALESCE(SUM(quantity_change), 0) AS stock
             FROM inventory_movements
            WHERE product_id = ?`,
          [productId],
        );

        const currentStock = Number(balances[0]?.stock ?? 0);
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
