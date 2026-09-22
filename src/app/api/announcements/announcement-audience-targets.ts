import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

export type AnnouncementAudienceTarget = {
  targetType: "Barangay" | "Sector";
  targetValue: string;
};

function isTargetAudience(type: unknown): type is AnnouncementAudienceTarget["targetType"] {
  return type === "Barangay" || type === "Sector";
}

export function normalizeAnnouncementAudienceTargets(body: any): AnnouncementAudienceTarget[] {
  if (!isTargetAudience(body?.audienceType)) return [];

  const rawTargets = Array.isArray(body.audienceTargets)
    ? body.audienceTargets
    : Array.isArray(body.audienceValues)
      ? body.audienceValues
      : typeof body.audienceValue === "string" && body.audienceValue.trim()
        ? body.audienceValue.split(",")
        : [];

  const values: string[] = rawTargets
    .map((target: unknown): string => {
      if (typeof target === "string") return target.trim();
      if (target && typeof target === "object" && "targetValue" in target) {
        return String((target as { targetValue?: unknown }).targetValue ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);

  return Array.from(new Set(values)).map((targetValue) => ({
    targetType: body.audienceType,
    targetValue,
  }));
}

export function getAudienceValueForTargets(body: any, targets: AnnouncementAudienceTarget[]) {
  if (targets.length > 0) {
    const joined = targets.map((target) => target.targetValue).join(", ");
    return joined.length <= 190 ? joined : `${targets.length} ${targets[0].targetType.toLowerCase()} targets`;
  }
  return typeof body?.audienceValue === "string" && body.audienceValue.trim()
    ? body.audienceValue.trim()
    : null;
}

export async function replaceAnnouncementAudienceTargets(
  announcementId: string | number,
  targets: AnnouncementAudienceTarget[],
) {
  await db.query(`DELETE FROM announcement_audience_targets WHERE announcement_id = ?`, [announcementId]);

  for (const target of targets) {
    await db.query(
      `INSERT IGNORE INTO announcement_audience_targets (announcement_id, target_type, target_value)
       VALUES (?, ?, ?)`,
      [announcementId, target.targetType, target.targetValue],
    );
  }
}

export async function addAudienceTargetsToAnnouncements<T extends RowDataPacket>(rows: T[]) {
  const announcementIds = rows.map((row) => String(row.id)).filter(Boolean);
  if (announcementIds.length === 0) return rows;

  const placeholders = announcementIds.map(() => "?").join(", ");
  const [targetRows] = await db.query<(RowDataPacket & AnnouncementAudienceTarget & { announcementId: string })[]>(
    `SELECT CAST(announcement_id AS CHAR) AS announcementId,
            target_type AS targetType,
            target_value AS targetValue
       FROM announcement_audience_targets
      WHERE announcement_id IN (${placeholders})
      ORDER BY announcement_id, target_type, target_value`,
    announcementIds,
  );

  const targetsByAnnouncement = new Map<string, AnnouncementAudienceTarget[]>();
  for (const row of targetRows) {
    const targets = targetsByAnnouncement.get(row.announcementId) ?? [];
    targets.push({
      targetType: row.targetType,
      targetValue: row.targetValue,
    });
    targetsByAnnouncement.set(row.announcementId, targets);
  }

  return rows.map((row) => ({
    ...row,
    audienceTargets: targetsByAnnouncement.get(String(row.id)) ?? [],
  }));
}
