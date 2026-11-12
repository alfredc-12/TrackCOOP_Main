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
function id(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new AppError("Invalid identifier", 400, "INVALID_ID");
  return value;
}
async function audit(c: PoolConnection, userId: string, action: string, table: string, record: string, oldValue: unknown, newValue: unknown) {
  await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values) VALUES(?,?,?,?,?,?,?)", [userId, action, table, record, "Event management", oldValue == null ? null : JSON.stringify(oldValue), JSON.stringify(newValue)]);
}
const eventSelect = `SELECT CAST(a.activity_id AS CHAR) AS id,a.activity_code AS attendanceToken,a.activity_name AS title,DATE_FORMAT(a.activity_date,'%Y-%m-%d') AS date,TIME_FORMAT(a.activity_time,'%H:%i') AS time,a.activity_location AS location,a.description AS details,a.activity_status AS status,a.cancellation_reason AS cancellationReason,a.completed_at AS completedAt,a.is_rfm_qualifying AS qualifies FROM cooperative_activities a WHERE a.activity_code LIKE 'MANAGED-%'`;
async function lockedEvent(c: PoolConnection, eventId: string) {
  const [rows] = await c.execute<RowDataPacket[]>(`${eventSelect} AND a.activity_id=? FOR UPDATE`, [eventId]);
  if (!rows[0]) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  return rows[0];
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

export function createActivityRouter(authService: AuthService = createAuthService()) {
  const router = Router();
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairman = [createAuthenticate(authService), requireRoles("chairman")];
  router.get("/activities", ...staff, asyncHandler(async (_req, res) => {
    const [rows] = await getPool().query<RowDataPacket[]>(`${eventSelect} ORDER BY a.activity_date DESC,a.activity_time DESC,a.activity_id DESC LIMIT 500`);
    return sendSuccess(res, rows);
  }));
  router.post("/activities", ...chairman, asyncHandler(async (req, res) => {
    const input = parse(eventSchema, req.body);
    const eventId = await withTransaction(async c => {
      const [result] = await c.execute<ResultSetHeader>("INSERT INTO cooperative_activities(activity_code,activity_name,activity_date,activity_time,activity_location,description,is_rfm_qualifying,created_by) VALUES(CONCAT('MANAGED-',UUID()),?,?,?,?,?,?,?)", [input.title,input.date,input.time,input.location,input.details,input.qualifies,req.auth!.user.id]);
      const record = String(result.insertId); await audit(c, req.auth!.user.id, "activity.created", "cooperative_activities", record, null, input); return record;
    });
    return sendSuccess(res, { id: eventId }, { statusCode: 201 });
  }));
  router.get("/activities/:id", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    const [events] = await getPool().execute<RowDataPacket[]>(`${eventSelect} AND a.activity_id=?`, [eventId]);
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
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      if (previous.status !== "Scheduled") throw new AppError("Only scheduled events can be edited", 409, "EVENT_CLOSED");
      const [attendance] = await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM managed_activity_attendance WHERE activity_id=?", [eventId]);
      if (Number(attendance[0].n) && previous.date !== input.date) throw new AppError("Correct attendance before changing the event date", 409, "EVENT_HAS_ATTENDANCE");
      await c.execute("UPDATE cooperative_activities SET activity_name=?,activity_date=?,activity_time=?,activity_location=?,description=?,is_rfm_qualifying=? WHERE activity_id=?", [input.title,input.date,input.time,input.location,input.details,input.qualifies,eventId]);
      await audit(c, req.auth!.user.id, "activity.updated", "cooperative_activities", eventId, previous, input);
    }); return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/cancel", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(cancellationSchema, req.body ?? {});
    await withTransaction(async c => { const previous = await lockedEvent(c, eventId); if (previous.status !== "Scheduled") throw new AppError("Event is already closed",409,"EVENT_CLOSED"); await c.execute("UPDATE cooperative_activities SET activity_status='Cancelled',cancellation_reason=?,is_rfm_qualifying=0 WHERE activity_id=?",[input.reason || null,eventId]); await audit(c,req.auth!.user.id,"activity.cancelled","cooperative_activities",eventId,previous,{status:"Cancelled",reason:input.reason || null,qualifies:false}); });
    return sendSuccess(res, { id:eventId });
  }));
  router.post("/activities/:id/complete", ...chairman, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id);
    await withTransaction(async c => {
      const previous = await lockedEvent(c, eventId);
      if (previous.status !== "Scheduled") throw new AppError("Event is already closed", 409, "EVENT_CLOSED");
      if (!eventHasStarted(previous)) throw new AppError("An event can only be completed after its start time", 409, "EVENT_NOT_YET_HELD");
      await c.execute("UPDATE cooperative_activities SET activity_status='Completed',completed_at=NOW() WHERE activity_id=?", [eventId]);
      await audit(c, req.auth!.user.id, "activity.completed", "cooperative_activities", eventId, previous, { status: "Completed" });
    });
    return sendSuccess(res, { id: eventId });
  }));
  router.post("/activities/:id/attendance", ...staff, asyncHandler(async (req, res) => {
    const eventId = id(req.params.id), input = parse(attendanceSchema, req.body);
    const participationId = await withTransaction(async c => {
      const event = await lockedEvent(c,eventId);
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
      const event=await lockedEvent(c,eventId); if(event.status!=="Scheduled") throw new AppError("Event is cancelled",409,"EVENT_CANCELLED");
      const [rows]=await c.execute<RowDataPacket[]>("SELECT p.participation_status AS status,p.remarks FROM managed_activity_attendance x JOIN member_activity_participation p ON p.participation_id=x.participation_id WHERE x.activity_id=? AND x.participation_id=? FOR UPDATE",[eventId,participationId]);
      if(!rows[0]) throw new AppError("Attendance not found",404,"ATTENDANCE_NOT_FOUND");
      await c.execute("UPDATE member_activity_participation SET participation_status=?,remarks=?,recorded_by=? WHERE participation_id=?",[input.status,input.reason,req.auth!.user.id,participationId]);
      await audit(c,req.auth!.user.id,"attendance.corrected","member_activity_participation",participationId,rows[0],input);
    }); return sendSuccess(res,{id:participationId});
  }));
  return router;
}
