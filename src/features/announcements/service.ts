import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export async function getAnnouncements() {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 
      id, title, message, excerpt, audience_type as audienceType,
      audience_value as audienceValue, announcement_status as announcementStatus,
      featured_image_path as featuredImagePath, created_at as createdAt
     FROM announcements
     WHERE announcement_status != 'Archived' 
       AND audience_type = 'Public'
     ORDER BY created_at DESC`
  );
  return rows;
}

