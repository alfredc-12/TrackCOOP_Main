import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import { randomUUID } from "node:crypto";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const { id } = await params;
    const body = await request.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      values.push(body.title);
    }
    if (body.message !== undefined) {
      updates.push("message = ?");
      values.push(body.message);
    }
    if (body.excerpt !== undefined) {
      updates.push("excerpt = ?");
      values.push(body.excerpt || null);
    }
    if (body.audienceType !== undefined) {
      updates.push("audience_type = ?");
      values.push(body.audienceType);
    }
    if (body.audienceValue !== undefined) {
      updates.push("audience_value = ?");
      values.push(body.audienceValue || null);
    }
    if (body.announcementStatus !== undefined) {
      updates.push("announcement_status = ?");
      values.push(body.announcementStatus);
    }
    if (body.featuredImagePath !== undefined) {
      updates.push("featured_image_path = ?");
      values.push(body.featuredImagePath || null);
    }

    if (updates.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE announcements SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }

    if (body.recipientUserIds && body.audienceType === "Selected Users") {
      await db.query(`DELETE FROM announcement_recipients WHERE announcement_id = ?`, [id]);
      for (const userId of body.recipientUserIds) {
        await db.query(
          `INSERT INTO announcement_recipients (id, announcement_id, user_id) VALUES (?, ?, ?)`,
          [randomUUID(), id, userId]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`PATCH /api/announcements/[id] error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
