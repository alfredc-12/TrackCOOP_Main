import { Router } from "express";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { reportToXlsx } from "../records/report-service";
import type { ReportResult } from "../records/records-types";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().min(1).max(255),
  details: z.string().trim().max(4000).default(""),
  imagePath: z.string().trim().max(1000).nullable().optional(),
  qualifies: z.boolean().default(true),
}).strict();
const attendanceSchema = z.object({ memberId: z.string().regex(/^[1-9]\d*$/) }).strict();
const memberQrAttendanceSchema = z.object({ memberCode: z.string().trim().min(5).max(80) }).strict();
const correctionSchema = z.object({ status: z.enum(["Participated", "Voided"]), reason: z.string().trim().min(3).max(500) }).strict();
const cancellationSchema = z.object({ reason: z.string().trim().max(500).default("") }).strict();
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("Please check the event details", 400, "VALIDATION_ERROR");
  return result.data;
}

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function manilaDateKey(now = new Date()) {
  const parts = Object.fromEntries(
    manilaDateFormatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertSchedulableDate(date: string) {
  if (date < manilaDateKey()) {
    throw new AppError(
      "Events cannot be scheduled on a past date",
      409,
      "EVENT_DATE_PAST",
    );
  }
}

function id(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new AppError("Invalid identifier", 400, "INVALID_ID");
  return value;
}
async function audit(c: PoolConnection, userId: string, action: string, table: string, record: string, oldValue: unknown, newValue: unknown) {
  await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values) VALUES(?,?,?,?,?,?,?)", [userId, action, table, record, "Event management", oldValue == null ? null : JSON.stringify(oldValue), JSON.stringify(newValue)]);
}
const eventSelect = `SELECT CAST(a.activity_id AS CHAR) AS id,a.activity_code AS attendanceToken,a.activity_name AS title,DATE_FORMAT(a.activity_date,'%Y-%m-%d') AS date,TIME_FORMAT(a.activity_time,'%H:%i') AS time,a.activity_location AS location,a.description AS details,a.image_path AS imagePath,a.activity_status AS status,a.cancellation_reason AS cancellationReason,a.completed_at AS completedAt,a.is_rfm_qualifying AS qualifies,a.archived_at AS archivedAt,CAST(a.archived_by AS CHAR) AS archivedBy FROM cooperative_activities a WHERE a.activity_code LIKE 'MANAGED-%'`;
async function lockedEvent(c: PoolConnection, eventId: string) {
  const [rows] = await c.execute<RowDataPacket[]>(`${eventSelect} AND a.activity_id=? FOR UPDATE`, [eventId]);
  if (!rows[0]) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  return rows[0];
}

function assertEventIsActive(event: RowDataPacket) {
  if (event.archivedAt) {
    throw new AppError("Archived events must be restored before they can be changed", 409, "EVENT_ARCHIVED");
  }
}

async function withManagedEventDateLock<T>(
  connection: PoolConnection,
  date: string,
  excludedEventId: string | null,
  work: () => Promise<T>,
) {
  const lockName = `trackcoop:managed-event-date:${date}`;
  const [locks] = await connection.execute<RowDataPacket[]>(
    "SELECT GET_LOCK(?, 5) AS acquired",
    [lockName],
  );
  if (Number(locks[0]?.acquired) !== 1) {
    throw new AppError(
      "The event date is being updated by another request. Please try again.",
      409,
      "EVENT_DATE_BUSY",
    );
  }

  try {
    const parameters: string[] = [date];
    let query = "SELECT activity_id FROM cooperative_activities WHERE activity_code LIKE 'MANAGED-%' AND activity_date=?";
    if (excludedEventId) {
      query += " AND activity_id<>?";
      parameters.push(excludedEventId);
    }
    query += " LIMIT 1 FOR UPDATE";
    const [existing] = await connection.execute<RowDataPacket[]>(query, parameters);
    if (existing.length) {
      throw new AppError(
        "Only one event can be scheduled per day. Please choose another date.",
        409,
        "EVENT_DATE_TAKEN",
      );
    }
    return await work();
  } finally {
    await connection
      .execute("SELECT RELEASE_LOCK(?) AS released", [lockName])
      .catch(() => undefined);
  }
}
function eventStartTimestamp(event: RowDataPacket) {
  const date = String(event.date);
  const time = event.time ? String(event.time).slice(0, 8) : "00:00:00";
  return Date.parse(`${date}T${time}+08:00`);
}
function eventHasStarted(event: RowDataPacket) {
  return eventStartTimestamp(event) <= Date.now();
}
function assertAttendanceOpen(event: RowDataPacket) {
  if (!eventHasStarted(event)) throw new AppError("Attendance cannot be recorded before the event start time", 409, "EVENT_NOT_YET_HELD");
}

type EventAnnouncementStatus = "Scheduled" | "Completed" | "Cancelled";
type EventAnnouncementEvent = {
  title: string;
  date: string;
  time: string;
  location: string;
  details?: string | null;
  imagePath?: string | null;
  qualifies?: boolean | number | null;
};

function normalizeEventAnnouncementEvent(event: RowDataPacket): EventAnnouncementEvent {
  return {
    title: String(event.title),
    date: String(event.date),
    time: String(event.time ?? "00:00"),
    location: String(event.location),
    details: event.details == null ? null : String(event.details),
    imagePath: event.imagePath == null ? null : String(event.imagePath),
    qualifies: event.qualifies,
  };
}

function buildEventAnnouncement(
  event: EventAnnouncementEvent,
  status: EventAnnouncementStatus,
  cancellationReason?: string | null,
) {
  const statusLabel = status === "Scheduled" ? "New cooperative event" : `Cooperative event ${status.toLowerCase()}`;
  const attendanceNote = event.qualifies
    ? "Attendance for this event is included in member analytics."
    : "Attendance for this event is not included in member analytics.";
  const message = [
    `${statusLabel}: ${event.title}`,
    `Date: ${event.date}`,
    `Time: ${event.time}`,
    `Location: ${event.location}`,
    event.details ? `Details: ${event.details}` : null,
    cancellationReason ? `Cancellation reason: ${cancellationReason}` : null,
    attendanceNote,
  ].filter(Boolean).join("\n");

  return {
    title: `${statusLabel}: ${event.title}`,
    message,
    excerpt: `${event.date} at ${event.time} · ${event.location}${status === "Cancelled" ? " · Cancelled" : ""}`,
  };
}

async function syncEventAnnouncement(
  c: PoolConnection,
  eventId: string,
  event: EventAnnouncementEvent,
  status: EventAnnouncementStatus,
  postedBy: string,
  cancellationReason?: string | null,
) {
  const slug = `activity-${eventId}`;
  const content = buildEventAnnouncement(event, status, cancellationReason);
  const [existing] = await c.execute<RowDataPacket[]>(
    "SELECT announcement_id FROM announcements WHERE slug=? LIMIT 1 FOR UPDATE",
    [slug],
  );

  if (existing[0]) {
    await c.execute(
      "UPDATE announcements SET title=?,message=?,excerpt=?,featured_image_path=?,audience_type='All Members',announcement_status='Published',posted_at=COALESCE(posted_at,NOW()) WHERE announcement_id=?",
      [content.title, content.message, content.excerpt, event.imagePath ?? null, existing[0].announcement_id],
    );
    await c.execute(
      "DELETE FROM announcement_acknowledgments WHERE announcement_id=?",
      [existing[0].announcement_id],
    );
  } else {
    await c.execute(
      "INSERT INTO announcements(posted_by,title,slug,message,excerpt,audience_type,announcement_status,featured_image_path,posted_at) VALUES(?,?,?,?,?,'All Members','Published',?,NOW())",
      [postedBy, content.title, slug, content.message, content.excerpt, event.imagePath ?? null],
    );
  }

  await c.execute(
    "INSERT INTO notifications(user_id,notification_type,title,message,related_entity_type,related_entity_id) SELECT mp.user_id,'Announcement',?,?,?,? FROM member_profiles mp WHERE mp.approval_status='Approved' AND mp.user_id IS NOT NULL",
    [content.title, content.message, "cooperative_activities", eventId],
  );
}

export function createActivityRouter(authService: AuthService = createAuthService()) {
  const router = Router();
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairman = [createAuthenticate(authService), requireRoles("chairman")];
  router.get("/activities", ...staff, asyncHandler(async (_req, res) => {
    const [rows] = await getPool().query<RowDataPacket[]>(`${eventSelect} AND a.archived_at IS NULL ORDER BY a.activity_date DESC,a.activity_time DESC,a.activity_id DESC LIMIT 500`);
    return sendSuccess(res, rows);
  }));
  router.get("/activities/archived", ...staff, asyncHandler(async (_req, res) => {
    const [rows] = await getPool().query<RowDataPacket[]>(`${eventSelect} AND a.archived_at IS NOT NULL ORDER BY a.archived_at DESC,a.activity_date DESC,a.activity_id DESC LIMIT 500`);
    return sendSuccess(res, rows);
  }));
  router.post("/activities", ...chairman, asyncHandler(async (req, res) => {
    const input = parse(eventSchema, req.body);
    assertSchedulableDate(input.date);
    const eventId = await withTransaction(async c => {
      return withManagedEventDateLock(c, input.date, null, async () => {
        const [result] = await c.execute<ResultSetHeader>("INSERT INTO cooperative_activities(activity_code,activity_name,activity_date,activity_time,activity_location,description,image_path,is_rfm_qualifying,created_by) VALUES(CONCAT('MANAGED-',UUID()),?,?,?,?,?,?,?,?)", [input.title,input.date,input.time,input.location,input.details,input.imagePath ?? null,input.qualifies,req.auth!.user.id]);
        const record = String(result.insertId);
        await syncEventAnnouncement(c, record, input, "Scheduled", String(req.auth!.user.id));
        await audit(c, req.auth!.user.id, "activity.created", "cooperative_activities", record, null, input);
        return record;
      });
    });
    return sendSuccess(res, { id: eventId }, { statusCode: 201 });
  }));
  router.get("/activities/:id", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    const [events] = await getPool().execute<RowDataPacket[]>(`${eventSelect} AND a.activity_id=? AND a.archived_at IS NULL`, [eventId]);
    if (!events[0]) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    const [attendance] = await getPool().execute<RowDataPacket[]>("SELECT CAST(p.participation_id AS CHAR) AS id,CAST(p.member_id AS CHAR) AS memberId,m.member_code AS memberCode,m.full_name AS memberName,DATE_FORMAT(p.participation_date,'%Y-%m-%d') AS date,p.participation_status AS status,p.remarks FROM managed_activity_attendance x JOIN member_activity_participation p ON p.participation_id=x.participation_id JOIN member_profiles m ON m.member_id=p.member_id WHERE x.activity_id=? ORDER BY m.full_name", [eventId]);
    const [eligible] = await getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM member_profiles WHERE approval_status='Approved'");
    return sendSuccess(res, { ...events[0], eligibleMemberCount: Number(eligible[0]?.total ?? 0), attendance });
  }));
  router.get("/activities/:id/attendance/export", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    const [events] = await getPool().execute<RowDataPacket[]>(`${eventSelect} AND a.activity_id=?`, [eventId]);
    const event = events[0];
    if (!event) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    const [attendance] = await getPool().execute<RowDataPacket[]>("SELECT CAST(p.participation_id AS CHAR) AS id,CAST(p.member_id AS CHAR) AS memberId,m.member_code AS memberCode,m.full_name AS memberName,DATE_FORMAT(p.participation_date,'%Y-%m-%d') AS date,p.participation_status AS status,p.remarks FROM managed_activity_attendance x JOIN member_activity_participation p ON p.participation_id=x.participation_id JOIN member_profiles m ON m.member_id=p.member_id WHERE x.activity_id=? ORDER BY m.full_name", [eventId]);
    const [eligible] = await getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM member_profiles WHERE approval_status='Approved'");
    const eligibleCount = Number(eligible[0]?.total ?? 0);
    const participatedCount = attendance.filter((row) => row.status === "Participated").length;
    const report: ReportResult = {
      reportId: `activity-attendance-${eventId}`,
      reportReference: `ACT-ATT-${eventId}`,
      reportKey: "activity-attendance",
      reportName: `Attendance - ${event.title}`,
      category: "AGENCY_COOPERATIVE",
      generatedAt: new Date().toISOString(),
      generatedBy: req.auth!.user.displayName,
      periodLabel: `${event.date} · ${event.status}`,
      appliedFilters: { dateFrom: String(event.date), dateTo: String(event.date) },
      summary: [
        { label: "Eligible approved members", value: eligibleCount, format: "number" },
        { label: "Participated", value: participatedCount, format: "number" },
        { label: "Voided records", value: attendance.filter((row) => row.status === "Voided").length, format: "number" },
        { label: "Participation rate (%)", value: eligibleCount > 0 ? Math.round((participatedCount / eligibleCount) * 100) : 0, format: "number" },
      ],
      columns: [
        { key: "memberName", label: "Member" },
        { key: "memberCode", label: "Member code" },
        { key: "status", label: "Status" },
        { key: "participationDate", label: "Participation date", format: "date" },
        { key: "remarks", label: "Remarks" },
      ],
      rows: attendance.map((row) => ({
        memberName: String(row.memberName),
        memberCode: String(row.memberCode),
        status: String(row.status),
        participationDate: String(row.date),
        remarks: row.remarks == null ? null : String(row.remarks),
      })),
      total: attendance.length,
    };
    const workbook = await reportToXlsx(report);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trackcoop-attendance-${event.date}-${eventId}.xlsx"`,
      "Content-Length": String(workbook.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    }).send(workbook);
  }));
  router.patch("/activities/:id", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(eventSchema, req.body);
    assertSchedulableDate(input.date);
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      assertEventIsActive(previous);
      if (previous.status !== "Scheduled") throw new AppError("Only scheduled events can be edited", 409, "EVENT_CLOSED");
      const [attendance] = await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM managed_activity_attendance WHERE activity_id=?", [eventId]);
      if (Number(attendance[0].n) && previous.date !== input.date) throw new AppError("Correct attendance before changing the event date", 409, "EVENT_HAS_ATTENDANCE");
      await withManagedEventDateLock(c, input.date, eventId, async () => {
        await c.execute("UPDATE cooperative_activities SET activity_name=?,activity_date=?,activity_time=?,activity_location=?,description=?,image_path=?,is_rfm_qualifying=? WHERE activity_id=?", [input.title,input.date,input.time,input.location,input.details,input.imagePath ?? null,input.qualifies,eventId]);
        await syncEventAnnouncement(c, eventId, input, "Scheduled", String(req.auth!.user.id));
        await audit(c, req.auth!.user.id, "activity.updated", "cooperative_activities", eventId, previous, input);
      });
    }); return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/cancel", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(cancellationSchema, req.body ?? {});
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      assertEventIsActive(previous);
      if (previous.status !== "Scheduled") throw new AppError("Event is already closed",409,"EVENT_CLOSED");
      await c.execute("UPDATE cooperative_activities SET activity_status='Cancelled',cancellation_reason=?,is_rfm_qualifying=0 WHERE activity_id=?",[input.reason || null,eventId]);
      await syncEventAnnouncement(c, eventId, { ...normalizeEventAnnouncementEvent(previous), qualifies: false }, "Cancelled", String(req.auth!.user.id), input.reason || null);
      await audit(c,req.auth!.user.id,"activity.cancelled","cooperative_activities",eventId,previous,{status:"Cancelled",reason:input.reason || null,qualifies:false});
    });
    return sendSuccess(res, { id:eventId });
  }));
  router.post("/activities/:id/complete", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      assertEventIsActive(previous);
      if (previous.status !== "Scheduled") throw new AppError("Event is already closed", 409, "EVENT_CLOSED");
      if (!eventHasStarted(previous)) throw new AppError("An event can only be completed after its start time", 409, "EVENT_NOT_YET_HELD");
      await c.execute("UPDATE cooperative_activities SET activity_status='Completed',completed_at=NOW() WHERE activity_id=?", [eventId]);
      await syncEventAnnouncement(c, eventId, normalizeEventAnnouncementEvent(previous), "Completed", String(req.auth!.user.id));
      await audit(c, req.auth!.user.id, "activity.completed", "cooperative_activities", eventId, previous, { status: "Completed" });
    });
    return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/archive", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      assertEventIsActive(previous);
      if (previous.status === "Scheduled") {
        throw new AppError(
          "Complete or cancel the event before archiving it",
          409,
          "EVENT_STILL_SCHEDULED",
        );
      }
      await c.execute(
        "UPDATE cooperative_activities SET archived_at=NOW(),archived_by=? WHERE activity_id=?",
        [req.auth!.user.id, eventId],
      );
      await audit(c, req.auth!.user.id, "activity.archived", "cooperative_activities", eventId, previous, { archived: true });
    });
    return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/restore", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      if (!previous.archivedAt) throw new AppError("Event is not archived", 409, "EVENT_NOT_ARCHIVED");
      await c.execute(
        "UPDATE cooperative_activities SET archived_at=NULL,archived_by=NULL WHERE activity_id=?",
        [eventId],
      );
      await audit(c, req.auth!.user.id, "activity.restored", "cooperative_activities", eventId, previous, { archived: false });
    });
    return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/attendance", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(attendanceSchema, req.body);
    const participationId = await withTransaction(async c => {
      const event = await lockedEvent(c,eventId);
      assertEventIsActive(event);
      if (event.status !== "Scheduled") throw new AppError("Attendance is closed because this event is no longer scheduled",409,"EVENT_CLOSED");
      assertAttendanceOpen(event);
      const [members] = await c.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_id=? AND approval_status='Approved'",[input.memberId]);
      if (!members.length) throw new AppError("Approved member not found",404,"MEMBER_NOT_FOUND");
      const [existing] = await c.execute<RowDataPacket[]>("SELECT participation_id FROM managed_activity_attendance WHERE activity_id=? AND member_id=?",[eventId,input.memberId]);
      if (existing.length) throw new AppError("Attendance already recorded; use correction",409,"ATTENDANCE_EXISTS");
      const [result] = await c.execute<ResultSetHeader>("INSERT INTO member_activity_participation(member_id,activity_id,participation_date,participation_status,recorded_by) VALUES(?,?,?,'Participated',?)",[input.memberId,eventId,event.date,req.auth!.user.id]);
      const record=String(result.insertId); await c.execute("INSERT INTO managed_activity_attendance(activity_id,member_id,participation_id) VALUES(?,?,?)",[eventId,input.memberId,record]); await audit(c,req.auth!.user.id,"attendance.recorded","member_activity_participation",record,null,{eventId,memberId:input.memberId,status:"Participated"}); return record;
    }); return sendSuccess(res,{id:participationId},{statusCode:201});
  }));
  router.post("/activities/:id/attendance/scan", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(memberQrAttendanceSchema, req.body);
    const result = await withTransaction(async c => {
      const event = await lockedEvent(c, eventId);
      assertEventIsActive(event);
      if (event.status !== "Scheduled") throw new AppError("Attendance is closed because this event is no longer scheduled", 409, "EVENT_CLOSED");
      assertAttendanceOpen(event);

      const [members] = await c.execute<RowDataPacket[]>("SELECT member_id,member_code,full_name FROM member_profiles WHERE member_code=? AND approval_status='Approved' LIMIT 1", [input.memberCode]);
      const member = members[0];
      if (!member) throw new AppError("Approved member profile not found", 404, "MEMBER_NOT_FOUND");

      const [existing] = await c.execute<RowDataPacket[]>("SELECT participation_id FROM managed_activity_attendance WHERE activity_id=? AND member_id=?", [eventId, member.member_id]);
      if (existing.length) throw new AppError("Attendance already recorded for this event", 409, "ATTENDANCE_EXISTS");

      const [participation] = await c.execute<ResultSetHeader>("INSERT INTO member_activity_participation(member_id,activity_id,participation_date,participation_status,source_reference,recorded_by) VALUES(?,?,?,'Participated',?,?)", [member.member_id, eventId, event.date, `QR:MEMBER:${member.member_code}`, req.auth!.user.id]);
      const participationId = String(participation.insertId);
      await c.execute("INSERT INTO managed_activity_attendance(activity_id,member_id,participation_id) VALUES(?,?,?)", [eventId, member.member_id, participationId]);
      await audit(c, req.auth!.user.id, "attendance.qr_recorded", "member_activity_participation", participationId, null, { eventId, memberId: String(member.member_id), source: "Member QR", status: "Participated" });
      return { id: participationId, memberName: member.full_name, eventTitle: event.title, eventDate: event.date };
    });
    return sendSuccess(res, result, { statusCode: 201 });
  }));
  router.patch("/activities/:id/attendance/:participationId", ...staff, asyncHandler(async (req,res) => {
    const eventId=id(req.params.id), participationId=id(req.params.participationId), input=parse(correctionSchema,req.body);
    await withTransaction(async c => {
      const event=await lockedEvent(c,eventId); assertEventIsActive(event); if(event.status!=="Scheduled") throw new AppError("Event is cancelled",409,"EVENT_CANCELLED");
      const [rows]=await c.execute<RowDataPacket[]>("SELECT p.participation_status AS status,p.remarks FROM managed_activity_attendance x JOIN member_activity_participation p ON p.participation_id=x.participation_id WHERE x.activity_id=? AND x.participation_id=? FOR UPDATE",[eventId,participationId]);
      if(!rows[0]) throw new AppError("Attendance not found",404,"ATTENDANCE_NOT_FOUND");
      await c.execute("UPDATE member_activity_participation SET participation_status=?,remarks=?,recorded_by=? WHERE participation_id=?",[input.status,input.reason,req.auth!.user.id,participationId]);
      await audit(c,req.auth!.user.id,"attendance.corrected","member_activity_participation",participationId,rows[0],input);
    }); return sendSuccess(res,{id:participationId});
  }));
  return router;
}
