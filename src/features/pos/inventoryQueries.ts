import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

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
};

type InventoryMovementRow = RowDataPacket & {
  product_id: number | string;
  type: string;
  amount: number | string;
  date: string | Date;
};

export type InventoryProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  description: string;
  unit: string;
  stock: number;
  pending_qty: number;
  sold: number;
  status: string;
  img: string;
  history?: {
    type: "add" | "deduct";
    amount: number;
    date: string | Date;
  }[];
};

type ListInventoryProductsOptions = {
  includeHistory?: boolean;
  publicOnly?: boolean;
};

function mapProductStatus(status: string) {
  if (status === "Active") return "Available";
  if (status === "Out of Stock") return "Unavailable";
  return status;
}

export async function listInventoryProducts({
  includeHistory = false,
  publicOnly = false,
}: ListInventoryProductsOptions = {}) {
  const [rows] = await db.query<InventoryProductRow[]>(`
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
      p.image_path as img
    FROM products p
    LEFT JOIN v_product_inventory_balance v ON p.product_id = v.product_id
    WHERE p.product_status <> 'Archived'
    ORDER BY p.product_name ASC
  `);

  let movementsByProduct = new Map<number, InventoryProduct["history"]>();

  if (includeHistory) {
    const [movements] = await db.query<InventoryMovementRow[]>(`
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
      ...(includeHistory ? { history: movementsByProduct.get(id) ?? [] } : {}),
    };
  });

  if (!publicOnly) {
    return inventory;
  }

  return inventory.filter(
    (item) => item.status === "Available" && item.stock - item.pending_qty > 0,
  );
}
