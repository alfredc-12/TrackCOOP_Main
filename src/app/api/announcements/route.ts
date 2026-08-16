import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { requireApiUser, getOptionalApiUser } from "@/lib/next-api-auth";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getOptionalApiUser();

    let query = `SELECT 
        a.announcement_id as id, a.title, a.message, a.excerpt, a.audience_type as audienceType,
        a.audience_value as audienceValue, a.announcement_status as announcementStatus,
        a.featured_image_path as featuredImagePath, a.created_at as createdAt,
        (SELECT COUNT(*) FROM announcement_acknowledgments ack WHERE ack.announcement_id = a.announcement_id) as acknowledgmentCount
       FROM announcements a`;
       
    const params: any[] = [];
       
    if (!user) {
      query += ` WHERE a.audience_type = 'Public' AND a.announcement_status != 'Archived'`;
    }
    
    query += ` ORDER BY a.created_at DESC`;

    const [rows] = await db.query<RowDataPacket[]>(query, params);

    return NextResponse.json({
      success: true,
      data: rows,
      message: "Announcements retrieved successfully",
      meta: {}
    });
  } catch (error) {
    console.error("GET /api/announcements error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const body = await request.json();
    
    const [result] = await db.query<any>(
      `INSERT INTO announcements (posted_by, title, message, excerpt, audience_type, audience_value, announcement_status, featured_image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.numericId,
        body.title,
        body.message,
        body.excerpt || null,
        body.audienceType,
        body.audienceValue || null,
        body.announcementStatus || 'Published',
        body.featuredImagePath || null
      ]
    );

    const announcementId = result.insertId;

    if (body.recipientUserIds && body.recipientUserIds.length > 0) {
      for (const userId of body.recipientUserIds) {
        await db.query(
          `INSERT INTO announcement_recipients (announcement_id, user_id) VALUES (?, ?)`,
          [announcementId, userId]
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: announcementId },
      message: "Announcement created",
      meta: {}
    });
  } catch (error) {
    console.error("POST /api/announcements error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
