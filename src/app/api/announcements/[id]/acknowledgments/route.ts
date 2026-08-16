import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import type { RowDataPacket } from "mysql2/promise";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const { id } = await params;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT user_id as userId, full_name as fullName, acknowledged_at as acknowledgedAt
       FROM announcement_acknowledgments
       WHERE announcement_id = ?
       ORDER BY acknowledged_at DESC`,
      [id]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error(`GET /api/announcements/[id]/acknowledgments error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
