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
  reorder_level: number;
  history?: {
    type: "add" | "deduct";
    amount: number;
    date: string | Date;
  }[];
};

export type InventoryProductInput = {
  name?: string;
  category?: string;
  price?: number | string;
  cost_price?: number | string;
  description?: string;
  unit?: string;
  stock?: number | string;
  status?: "Available" | "Unavailable";
  img?: string;
  reorder_level?: number | string;
};

export type InventoryStockInput = {
  amount?: number | string;
  type?: "add" | "deduct" | string;
};
