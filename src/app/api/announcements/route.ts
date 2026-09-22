import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, getOptionalApiUser } from "@/lib/next-api-auth";
import type { RowDataPacket } from "mysql2/promise";
import {
  addImagesToAnnouncements,
  normalizeAnnouncementImages,
  replaceAnnouncementImages,
} from "./announcement-images";
import {
  addAudienceTargetsToAnnouncements,
  getAudienceValueForTargets,
  normalizeAnnouncementAudienceTargets,
  replaceAnnouncementAudienceTargets,
} from "./announcement-audience-targets";

export const dynamic = 'force-dynamic';

type MemberAudienceProfile = RowDataPacket & {
  memberId: string;
  membershipType: string | null;
  barangay: string | null;
  sector: string | null;
};

async function getAudienceProfile(userId: number) {
  const [rows] = await db.query<MemberAudienceProfile[]>(
    `SELECT CAST(member_id AS CHAR) AS memberId,
            membership_type AS membershipType,
            barangay,
            sector
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

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
    } else if (user.role !== "chairman") {
      const profile = await getAudienceProfile(user.numericId);
      query += ` WHERE a.announcement_status = 'Published'
        AND a.announcement_status != 'Archived'
        AND (
          a.audience_type = 'Public'
          OR (a.audience_type = 'All Members' AND ? <> '0')
          OR (a.audience_type = 'Associate Members' AND ? = 'Associate')
          OR (a.audience_type = 'True Members' AND ? = 'True Member')
          OR (a.audience_type = 'Barangay' AND ? <> '' AND (
            a.audience_value = ?
            OR EXISTS (
              SELECT 1 FROM announcement_audience_targets aat
               WHERE aat.announcement_id = a.announcement_id
                 AND aat.target_type = 'Barangay'
                 AND aat.target_value = ?
            )
          ))
          OR (a.audience_type = 'Sector' AND ? <> '' AND (
            a.audience_value = ?
            OR EXISTS (
              SELECT 1 FROM announcement_audience_targets aat
               WHERE aat.announcement_id = a.announcement_id
                 AND aat.target_type = 'Sector'
                 AND aat.target_value = ?
            )
          ))
          OR (a.audience_type = 'Selected Users' AND EXISTS (
            SELECT 1 FROM announcement_recipients ar
             WHERE ar.announcement_id = a.announcement_id AND ar.user_id = ?
          ))
        )`;
      params.push(
        profile?.memberId ?? "0",
        profile?.membershipType ?? "",
        profile?.membershipType ?? "",
        profile?.barangay ?? "",
        profile?.barangay ?? "",
        profile?.barangay ?? "",
        profile?.sector ?? "",
        profile?.sector ?? "",
        profile?.sector ?? "",
        user.numericId,
      );
    }
    
    query += ` ORDER BY a.created_at DESC`;

    const [rows] = await db.query<RowDataPacket[]>(query, params);
    const withTargets = await addAudienceTargetsToAnnouncements(rows);
    const announcements = await addImagesToAnnouncements(withTargets);

    return NextResponse.json({
      success: true,
      data: announcements,
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
    const images = normalizeAnnouncementImages(body);
    const featuredImagePath = images[0] ?? null;
    const audienceTargets = normalizeAnnouncementAudienceTargets(body);
    const audienceValue = getAudienceValueForTargets(body, audienceTargets);
    
    const [result] = await db.query<any>(
      `INSERT INTO announcements (posted_by, title, message, excerpt, audience_type, audience_value, announcement_status, featured_image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.numericId,
        body.title,
        body.message,
        body.excerpt || null,
        body.audienceType,
        audienceValue,
        body.announcementStatus || 'Published',
        featuredImagePath
      ]
    );

    const announcementId = result.insertId;
    await replaceAnnouncementImages(announcementId, images, body.title);
    await replaceAnnouncementAudienceTargets(announcementId, audienceTargets);

    if (body.audienceType === "Selected Users" && body.recipientUserIds && body.recipientUserIds.length > 0) {
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
