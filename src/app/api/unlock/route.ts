import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const connection = await db.getConnection();
  try {
    await connection.query("UPDATE users SET locked_until = NULL, failed_login_count = 0");
    return NextResponse.json({ message: "All accounts unlocked successfully!" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    connection.release();
  }
}
