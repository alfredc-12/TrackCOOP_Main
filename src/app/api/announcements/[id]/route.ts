import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  hasAnnouncementImagePayload,
  normalizeAnnouncementImages,
  replaceAnnouncementImages,
} from "../announcement-images";
import {
  getAudienceValueForTargets,
  normalizeAnnouncementAudienceTargets,
  replaceAnnouncementAudienceTargets,
} from "../announcement-audience-targets";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const { id } = await params;
    const body = await request.json();
    const shouldUpdateImages = hasAnnouncementImagePayload(body);
    const images = shouldUpdateImages ? normalizeAnnouncementImages(body) : [];
    const shouldUpdateTargets =
      Object.prototype.hasOwnProperty.call(body, "audienceTargets") ||
      Object.prototype.hasOwnProperty.call(body, "audienceValues") ||
      Object.prototype.hasOwnProperty.call(body, "audienceType");
    const audienceTargets = shouldUpdateTargets ? normalizeAnnouncementAudienceTargets(body) : [];

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
    if (body.audienceValue !== undefined || shouldUpdateTargets) {
      updates.push("audience_value = ?");
      values.push(getAudienceValueForTargets(body, audienceTargets));
    }
    if (body.announcementStatus !== undefined) {
      updates.push("announcement_status = ?");
      values.push(body.announcementStatus);
    }
    if (shouldUpdateImages) {
      updates.push("featured_image_path = ?");
      values.push(images[0] ?? null);
    }

    if (updates.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE announcements SET ${updates.join(", ")} WHERE announcement_id = ?`,
        values
      );
    }

    if (shouldUpdateImages) {
      await replaceAnnouncementImages(id, images, body.title);
    }

    if (shouldUpdateTargets) {
      await replaceAnnouncementAudienceTargets(id, audienceTargets);
    }

    if (body.recipientUserIds || (body.audienceType && body.audienceType !== "Selected Users")) {
      await db.query(`DELETE FROM announcement_recipients WHERE announcement_id = ?`, [id]);
      const recipientUserIds = body.audienceType === "Selected Users" ? body.recipientUserIds ?? [] : [];
      for (const userId of recipientUserIds) {
        await db.query(
          `INSERT IGNORE INTO announcement_recipients (announcement_id, user_id) VALUES (?, ?)`,
          [id, userId]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`PATCH /api/announcements/[id] error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
