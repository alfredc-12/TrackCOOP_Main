import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const { id } = await params;

    await db.query(
      `UPDATE announcements SET announcement_status = 'Archived' WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`POST /api/announcements/[id]/archive error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
