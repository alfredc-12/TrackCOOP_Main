import { NextResponse } from "next/server";
import { listInventoryProducts } from "@/features/pos/inventoryQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listInventoryProducts({ publicOnly: true }));
  } catch (error) {
    console.error("Failed to fetch store products:", error);
    return NextResponse.json({ error: "Failed to fetch store products" }, { status: 500 });
  }
}
