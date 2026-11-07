import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { type TestContext } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import type { PoolConnection } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { env } from "../../config/env";
import { errorHandler } from "../../middleware/error-handler";
import { storageProvider } from "../../storage";
import { manilaToday } from "../../utils/manila-calendar";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import { calculateDocumentStatus, listDocuments } from "./document-service";
import { createRecordsRouter } from "./records.routes";

const day = (base: string, offset: number) => new Date(Date.parse(`${base}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const pdf = Buffer.from("%PDF-synthetic");
type Row = { id: string; memberId: string | null; accessLevel: string; databaseStatus: string; expirationDate: string | null; category: string; documentType: string; uploadedById: string };
function setup(t: TestContext, role: RoleSlug = "chairman", rows: Row[] = []) {
  const pool = getPool();
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  let nextId = 100;
  const memberId = "101";
  const rowData = (r: Row) => ({ ...r, reference: `DOC-${r.id}`, title: `Document ${r.id}`, description: null,
    fileName: `file-${r.id}.pdf`, mimeType: "application/pdf", fileExtension: "", fileSizeBytes: 14,
    uploadedBy: "Synthetic User", uploadedAt: "2026-01-01", updatedAt: "2026-01-01" });
  const visible = (sql: string, values: unknown[], summary = false) => {
    const ownerIndex = summary ? 2 : 0;
    let selected = rows.filter((r) => role === "chairman" || (role === "bookkeeper" ? r.accessLevel === "Public" || r.accessLevel === "Bookkeeper-only" || (r.accessLevel !== "Admin-only" && r.category === "FINANCIAL") : r.accessLevel === "Public" || (r.accessLevel === "Member-only" && r.memberId === values[ownerIndex])));
    if (summary) return selected;
    for (const [stored, label] of [["Archived", "ARCHIVED"], ["Replaced", "REPLACED"], ["Restricted", "RESTRICTED"], ["Active", "ACTIVE"]]) {
      if (sql.includes(`d.document_status = '${stored}'`)) selected = selected.filter((r) => r.databaseStatus === stored);
      void label;
    }
    const re = /d\.expiration_date\s*(>=|<=|<|>)\s*\?/g;
    for (const m of sql.matchAll(re)) {
      const index = (sql.slice(0, m.index).match(/\?/g) ?? []).length;
      const target = String(values[index]);
      selected = selected.filter((r) => {
        if (!r.expirationDate) return sql.includes("d.expiration_date IS NULL OR");
        return m[1] === ">=" ? r.expirationDate >= target : m[1] === "<=" ? r.expirationDate <= target : m[1] === "<" ? r.expirationDate < target : r.expirationDate > target;
      });
    }
    return selected;
  };
  t.mock.method(pool, "query", async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM member_profiles")) return [[{ id: memberId }], []];
    if (sql.includes("INSERT INTO audit_logs")) { writes.push({ sql, values }); return [{ affectedRows: 1 }, []]; }
    if (sql.includes("FROM document_access_logs") || sql.includes("FROM audit_logs")) return [[], []];
    if (sql.includes("WHERE d.document_id = ?")) return [rows.filter((r) => r.id === values[0]).map(rowData), []];
    if (sql.includes("SELECT DISTINCT CAST(u.user_id")) return [[], []];
    if (sql.includes("SUM(d.uploaded_at")) {
      const selected = visible(sql, values, true), today = String(values[0]), end = String(values[1]);
      return [[{ total: selected.length, recentlyUploaded: 0, archived: selected.filter((r) => r.databaseStatus === "Archived").length,
        restricted: 0, expiringSoon: selected.filter((r) => r.databaseStatus === "Active" && r.expirationDate && r.expirationDate >= today && r.expirationDate <= end).length }], []];
    }
    if (sql.includes("SELECT COUNT(*) AS total")) return [[{ total: visible(sql, values).length }], []];
    if (sql.includes("FROM documents d")) {
      assert.ok(sql.includes("DATE_FORMAT(d.expiration_date"));
      const m = sql.match(/LIMIT (\d+) OFFSET (\d+)/); assert.ok(m);
      return [visible(sql, values).slice(Number(m[2]), Number(m[2]) + Number(m[1])).map(rowData), []];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  t.mock.method(pool, "execute", async () => { throw new Error("Unexpected real database access"); });
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql: string, values: unknown[] = []) {
      writes.push({ sql, values });
      if (sql.includes("INSERT INTO documents (")) {
        assert.ok(sql.includes("expiration_date"));
        assert.ok(sql.includes("checksum_sha256"));
        assert.equal(values[12], createHash("sha256").update(pdf).digest("hex"));
        const id = String(nextId++);
        rows.push({ id, memberId: null, accessLevel: String(values[5]), databaseStatus: "Active", category: String(values[3]), documentType: String(values[4]), uploadedById: "1", expirationDate: values[11] as string | null });
        return [{ insertId: Number(id) }, []];
      }
      if (sql.includes("SET title = ?")) {
        assert.ok(sql.includes("expiration_date = CASE WHEN ?"));
        const r = rows.find((x) => x.id === values[7]); assert.ok(r);
        if (values[5]) r.expirationDate = values[6] as string | null;
      }
      if (sql.includes("SET document_status = 'Archived'")) { const r = rows.find((x) => x.id === values[0]); assert.ok(r); r.databaseStatus = "Archived"; }
      if (sql.includes("SET document_status = 'Active'")) { const r = rows.find((x) => x.id === values[0]); assert.ok(r); r.databaseStatus = "Active"; }
      return [{ affectedRows: 1 }, []];
    },
  } as unknown as PoolConnection;
  t.mock.method(pool, "getConnection", async () => connection);
  const put = t.mock.method(storageProvider(), "put", async (input: Parameters<ReturnType<typeof storageProvider>["put"]>[0]) => ({ key: input.key, path: `public/uploads/${input.key}`, size: input.body.length }));
  const del = t.mock.method(storageProvider(), "delete", async () => {});
  const auth: AuthContext = { sessionId: "synthetic", tokenHash: "synthetic", user: { id: "1", role, displayName: "Synthetic", email: "synthetic@example.test", username: "synthetic" } };
  const service = { async authenticate() { return auth; } } as unknown as AuthService;
  const app = express(); app.use(cookieParser()); app.use(express.json()); app.use("/api", createRecordsRouter(service)); app.use(errorHandler);
  const cookie = `${env.SESSION_COOKIE_NAME}=synthetic-token`;
  const metadata = (expirationDate?: unknown) => ({ title: "Synthetic document", category: "FINANCIAL", documentType: "Receipt", accessLevel: "MEMBER_ONLY", ...(expirationDate !== undefined ? { expirationDate } : {}) });
  const update = (id: string, data: object) => request(app).patch(`/api/documents/${id}`).set("Cookie", cookie).send({ action: "update", document: data });
  const upload = (value?: string) => {
    const req = request(app).post("/api/documents").set("Cookie", cookie).field("title", "Synthetic document").field("category", "FINANCIAL").field("documentType", "Receipt").field("accessLevel", "MEMBER_ONLY");
    if (value !== undefined) req.field("expirationDate", value);
    return req.attach("file", pdf, "synthetic.pdf");
  };
  return { app, rows, calls, writes, cookie, metadata, upload, update, put, del, auth };
}

const fixture = (id: string, expirationDate: string | null, databaseStatus = "Active", memberId: string | null = "101"): Row => ({ id, expirationDate, databaseStatus, memberId, accessLevel: "Member-only", category: "FINANCIAL", documentType: "Receipt", uploadedById: "1" });

test("Manila day and thirty-day warning boundaries remain stable across UTC midnight", () => {
  const before = new Date("2026-11-05T15:59:59.999Z"), after = new Date("2026-11-05T16:00:00.000Z");
  assert.equal(calculateDocumentStatus("Active", "2026-11-05", before), "EXPIRING_SOON");
  assert.equal(calculateDocumentStatus("Active", "2026-11-05", after), "EXPIRED");
  for (const [offset, expected] of [[-1, "EXPIRED"], [0, "EXPIRING_SOON"], [1, "EXPIRING_SOON"], [30, "EXPIRING_SOON"], [31, "ACTIVE"]] as const) {
    assert.equal(calculateDocumentStatus("Active", day("2026-11-06", offset), after), expected);
  }
  assert.equal(calculateDocumentStatus("Active", null, after), "ACTIVE");
  for (const [status, expected] of [["Archived", "ARCHIVED"], ["Replaced", "REPLACED"], ["Restricted", "RESTRICTED"], ["unknown", "RESTRICTED"]] as const) {
    assert.equal(calculateDocumentStatus(status, "2020-01-01", after), expected);
  }
});

test("upload persists valid expiry or null and returns it on detail", async (t) => {
  const api = setup(t);
  for (const [value, expected] of [["2028-02-29", "2028-02-29"], [undefined, null]] as const) {
    const response = await api.upload(value); assert.equal(response.status, 201);
    const detail = await request(api.app).get(`/api/documents/${response.body.id}`).set("Cookie", api.cookie);
    assert.equal(detail.status, 200); assert.equal(detail.body.expirationDate, expected);
  }
  assert.equal(api.put.mock.callCount(), 2);
  assert.ok(api.writes.some((w) => w.values.includes("document.uploaded")));
});

test("invalid and impossible dates are rejected before writing or storing files", async (t) => {
  const api = setup(t);
  for (const value of ["2025-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "2026-1-01", "0000-01-01", "not-a-date"]) {
    const response = await api.upload(value); assert.equal(response.status, 422, value); assert.equal(response.body.code, "INVALID_EXPIRATION_DATE");
  }
  assert.equal(api.put.mock.callCount(), 0); assert.equal(api.writes.length, 0);
  api.rows.push(fixture("1", "2026-11-06"));
  for (const value of ["2025-02-29", 17, {}]) assert.equal((await api.update("1", api.metadata(value))).status, 422);
  assert.equal(api.rows[0].expirationDate, "2026-11-06");
});

test("authorized updates change, preserve omitted, and clear expiry while retaining audit", async (t) => {
  const api = setup(t, "chairman", [fixture("1", "2028-02-29")]);
  assert.equal((await api.update("1", api.metadata("2032-02-29"))).status, 200);
  assert.equal(api.rows[0].expirationDate, "2032-02-29");
  assert.equal((await api.update("1", api.metadata())).status, 200);
  assert.equal(api.rows[0].expirationDate, "2032-02-29");
  assert.equal((await api.update("1", api.metadata(null))).status, 200);
  assert.equal(api.rows[0].expirationDate, null);
  assert.equal((await api.update("1", api.metadata(""))).status, 200);
  assert.equal(api.rows[0].expirationDate, null);
  assert.equal(api.writes.filter((w) => w.values.includes("document.metadata_updated")).length, 4);
});

test("date updates require existing authorization and cannot also change publication access", async (t) => {
  const api = setup(t, "bookkeeper", [fixture("1", "2026-01-01", "Active", "202"), { ...fixture("2", null), accessLevel: "Admin-only" }]);
  assert.equal((await api.update("2", { ...api.metadata("2028-02-29"), accessLevel: "ADMIN_ONLY" })).status, 403);
  assert.equal((await api.update("1", { ...api.metadata("2028-02-29"), accessLevel: "PUBLIC" })).status, 422);
  assert.equal(api.rows[0].expirationDate, "2026-01-01"); assert.equal(api.writes.length, 0);
});

test("lists, ranges, counts, summary and pagination share one Manila basis and privacy scope", async (t) => {
  const now = new Date("2026-11-05T16:00:00.000Z"), today = "2026-11-06";
  const rows = [fixture("1", day(today, -1)), fixture("2", today), fixture("3", day(today, 30)), fixture("4", day(today, 31)), fixture("5", null), fixture("6", today, "Archived"), fixture("7", today, "Replaced"), fixture("8", today, "Restricted"), fixture("9", today, "Active", "202"), fixture("10", today, "Active", null)];
  const api = setup(t, "member", rows);
  const user = { ...api.auth.user, numericId: 1 };
  for (const [status, expected] of [["EXPIRED", ["1"]], ["EXPIRING_SOON", ["2", "3"]], ["ACTIVE", ["4", "5"]], ["ARCHIVED", ["6"]], ["REPLACED", ["7"]], ["RESTRICTED", ["8"]]] as const) {
    const result = await listDocuments({ status, pageSize: 1 }, user, now);
    assert.equal(result.total, expected.length, status); assert.equal(result.summary.expiringSoon, 2);
    const second = await listDocuments({ status, pageSize: 1, page: 2 }, user, now);
    assert.deepEqual([...result.documents, ...second.documents].map((r) => r.id), expected);
    assert.ok([...result.documents, ...second.documents].every((r) => r.status === status));
  }
  const range = await listDocuments({ expirationFrom: today, expirationTo: day(today, 1) }, user, now);
  assert.deepEqual(range.documents.map((r) => r.id), ["2", "6", "7", "8"]);
  await assert.rejects(() => listDocuments({ expirationFrom: "2026-02-30" }, user, now), { code: "INVALID_EXPIRATION_DATE" });
  await assert.rejects(() => listDocuments({ expirationFrom: "2026-12-01", expirationTo: "2026-11-01" }, user, now), { code: "INVALID_EXPIRATION_DATE" });
});

test("authorized export uses the same expired filter and excludes private staff-forbidden documents", async (t) => {
  const today = manilaToday();
  const api = setup(t, "bookkeeper", [fixture("1", day(today, -1)), fixture("2", today), { ...fixture("3", day(today, -1)), accessLevel: "Admin-only" }]);
  const response = await request(api.app).get("/api/documents/export?status=EXPIRED").set("Cookie", api.cookie);
  assert.equal(response.status, 200); assert.ok(response.text.includes('"DOC-1"')); assert.ok(!response.text.includes('"DOC-2"')); assert.ok(!response.text.includes('"DOC-3"'));
  assert.ok(api.writes.some((w) => w.sql.includes("document.register_exported")));
});

test("archive and restore preserve expiry and reject replaced/restricted state transitions", async (t) => {
  const yesterday = day(manilaToday(), -1);
  const api = setup(t, "chairman", [fixture("1", yesterday), fixture("2", yesterday, "Replaced"), fixture("3", yesterday, "Restricted")]);
  for (const action of ["archive", "restore"] as const) {
    const response = await request(api.app).patch("/api/documents/1").set("Cookie", api.cookie).send({ action, reason: "Synthetic archive" });
    assert.equal(response.status, 200); assert.equal(api.rows[0].expirationDate, yesterday);
    const detail = await request(api.app).get("/api/documents/1").set("Cookie", api.cookie);
    assert.equal(detail.body.status, action === "archive" ? "ARCHIVED" : "EXPIRED");
  }
  for (const id of ["2", "3"]) for (const action of ["archive", "restore"]) {
    assert.equal((await request(api.app).patch(`/api/documents/${id}`).set("Cookie", api.cookie).send({ action, reason: "Synthetic archive" })).status, 409);
  }
  assert.equal(api.del.mock.callCount(), 0);
  assert.ok(api.writes.some((w) => w.values.includes("document.archived")));
  assert.ok(api.writes.some((w) => w.values.includes("document.restored")));
});
