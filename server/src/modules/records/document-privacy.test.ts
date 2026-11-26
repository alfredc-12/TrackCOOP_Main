import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import type { PoolConnection } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { env } from "../../config/env";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import { storageProvider } from "../../storage";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import {
  canAccessDocument,
  documentVisibilitySql,
  type DocumentPolicyActor,
  type DocumentPolicyRecord,
} from "./document-policy";
import { createRecordsRouter } from "./records.routes";

type Fixture = {
  id: string;
  accessLevel: string;
  memberId: string | null;
  category: string;
  documentType: string;
  uploadedById: string;
};
const fixtures: Fixture[] = [
  { id: "1", accessLevel: "Public", memberId: null, category: "OTHER", documentType: "Public Document", uploadedById: "11" },
  { id: "2", accessLevel: "Member-only", memberId: "101", category: "FINANCIAL", documentType: "Receipt", uploadedById: "12" },
  { id: "3", accessLevel: "Member-only", memberId: "202", category: "FINANCIAL", documentType: "Receipt", uploadedById: "13" },
  { id: "4", accessLevel: "Member-only", memberId: null, category: "FINANCIAL", documentType: "Receipt", uploadedById: "14" },
  { id: "5", accessLevel: "Admin-only", memberId: "101", category: "FINANCIAL", documentType: "Financial Document", uploadedById: "15" },
  { id: "6", accessLevel: "Bookkeeper-only", memberId: null, category: "OTHER", documentType: "Other", uploadedById: "16" },
  { id: "7", accessLevel: "Member-only", memberId: "101", category: "OTHER", documentType: "Certificate", uploadedById: "17" },
  { id: "8", accessLevel: "Member-only", memberId: "9007199254740992", category: "FINANCIAL", documentType: "Receipt", uploadedById: "18" },
  { id: "9", accessLevel: "Member-only", memberId: "9007199254740993", category: "FINANCIAL", documentType: "Receipt", uploadedById: "19" },
];
const accessLabels = {
  Public: "PUBLIC", "Member-only": "MEMBER_ONLY", "Admin-only": "ADMIN_ONLY", "Bookkeeper-only": "BOOKKEEPER_ONLY",
} as const;
const actor = (role: RoleSlug, memberId?: string | number | null): DocumentPolicyActor => ({ role, userId: 1, memberId });
const members = [actor("member", "101"), actor("member", "202")];

for (const [label, who, expected] of [
  ["anonymous", null, ["1"]],
  ["member A", members[0], ["1", "2", "7"]],
  ["member B", members[1], ["1", "3"]],
  ["unlinked member", actor("member"), ["1"]],
  ["chairman", actor("chairman"), fixtures.map((f) => f.id)],
  ["bookkeeper", actor("bookkeeper"), ["1", "2", "3", "4", "6", "8", "9"]],
] as const) {
  test(`document policy preserves the permitted read set for ${label}`, () => {
    const readable = fixtures.filter((f) => canAccessDocument(who, {
      ...f, accessLevel: accessLabels[f.accessLevel as keyof typeof accessLabels],
    })).map((f) => f.id);
    assert.deepEqual(readable, expected);
  });
}

test("ownerless, invalid and rounded numeric owner identities fail closed", () => {
  const document: DocumentPolicyRecord = { accessLevel: "MEMBER_ONLY", category: "FINANCIAL", documentType: "Receipt" };
  for (const owner of [undefined, null, 0, -1, NaN, Infinity, "", "0", "101 OR 1=1", 9007199254740992]) {
    assert.equal(canAccessDocument(members[0], { ...document, memberId: owner }), false);
    assert.equal(canAccessDocument(actor("member", owner), { ...document, memberId: owner }), false);
    assert.deepEqual(documentVisibilitySql(actor("member", owner)).values, []);
  }
  assert.equal(canAccessDocument(actor("member", 101), { ...document, memberId: "101" }), true);
  assert.equal(canAccessDocument(actor("member", "9007199254740992"), { ...document, memberId: "9007199254740993" }), false);
  assert.equal(canAccessDocument(actor("member", "9007199254740993"), { ...document, memberId: "9007199254740993" }), true);
});

test("member visibility binds the owner as an exact BIGINT without exposing an ownerless branch", () => {
  const visibility = documentVisibilitySql(actor("member", "9007199254740993"));
  assert.match(visibility.sql, /d\.member_id = CAST\(\? AS UNSIGNED\)/);
  assert.doesNotMatch(visibility.sql, /IS NULL|9007199254740993/);
  assert.deepEqual(visibility.values, ["9007199254740993"]);
});

/** Mock only the database/storage boundaries; exercise the real router and document service. */
function setup(t: TestContext, role: RoleSlug = "member", memberId: string | null = "101", documents = fixtures, evidenceIds:string[] = [], evidenceError?:string) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  let historyReads = 0;
  let transactions = 0;
  let commits = 0;
  const pool = getPool();
  const visible = (sql: string, values: unknown[]) => {
    if (sql.includes("WHERE 1 = 1")) return documents;
    if (sql.includes("d.access_level IN ('Public', 'Bookkeeper-only')")) {
      for (const category of ["FINANCIAL", "RECEIPT", "RENTAL", "POS_AND_SALES", "INVENTORY"]) assert.ok(sql.includes(`'${category}'`));
      assert.ok(sql.includes("d.access_level <> 'Admin-only'"));
      return documents.filter((f) => f.accessLevel === "Public" || f.accessLevel === "Bookkeeper-only" ||
        (f.accessLevel !== "Admin-only" && (["FINANCIAL", "RECEIPT", "RENTAL", "POS_AND_SALES", "INVENTORY"].includes(f.category) || ["Receipt", "Financial Document"].includes(f.documentType))));
    }
    if (sql.includes("d.member_id = CAST(? AS UNSIGNED)")) {
      assert.doesNotMatch(sql, /d\.member_id IS NULL/);
      return documents.filter((f) => f.accessLevel === "Public" || (f.accessLevel === "Member-only" && f.memberId === values[0]));
    }
    assert.ok(sql.includes("WHERE d.access_level = 'Public'"), "every list/facet query must include visibility");
    return documents.filter((f) => f.accessLevel === "Public");
  };
  const row = (f: Fixture, sql: string) => ({
    ...f,
    // A missing owner SELECT must fail the authorized-own-document regression.
    memberId: sql.includes("CAST(d.member_id AS CHAR) AS memberId") ? f.memberId : undefined,
    reference: `DOC-${f.id}`, title: `Synthetic document ${f.id}`, description: `Private detail ${f.id}`,
    databaseStatus: "Active", fileName: `synthetic-${f.id}.pdf`, mimeType: "application/pdf", fileExtension: "pdf",
    fileSizeBytes: 12, expirationDate: null, uploadedBy: `Uploader ${f.uploadedById}`,
    uploadedAt: "2026-11-06T00:00:00Z", updatedAt: "2026-11-06T00:00:00Z",
  });
  t.mock.method(pool, "query", async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values });
    if (sql.includes("FROM member_profiles")) return [memberId === null ? [] : [{ id: memberId }], []];
    if (sql.includes("INSERT INTO audit_logs")) { writes.push({ sql, values }); return [{ affectedRows: 1 }, []]; }
    if (sql.includes("FROM document_access_logs") || sql.includes("FROM audit_logs")) {
      historyReads += 1;
      return [[{ id: "1", user: "Synthetic staff", action: "View", description: "Synthetic audit" }], []];
    }
    if (sql.includes("SELECT file_path AS storagePath")) return [[{ storagePath: `public/uploads/documents/${values[0]}.pdf` }], []];
    if (sql.includes("FROM finance_manual_evidence_links") || sql.includes("FROM finance_evidence_upload_intents")) {
      if(evidenceError) throw Object.assign(new Error("synthetic database error"),{code:evidenceError});
      return [evidenceIds.includes(String(values[0])) ? [{ found: 1 }] : [], []];
    }
    if (sql.includes("WHERE d.document_id = ?")) {
      const found = documents.find((f) => f.id === values[0]);
      return [found ? [row(found, sql)] : [], []];
    }
    if (sql.includes("SELECT DISTINCT CAST(u.user_id AS CHAR)")) {
      return [visible(sql, values).map((f) => ({ id: f.uploadedById, name: `Uploader ${f.uploadedById}` })), []];
    }
    if (sql.includes("SUM(d.uploaded_at")) {
      const total = visible(sql, values.slice(2)).length;
      return [[{ total, recentlyUploaded: total, expiringSoon: 0, archived: 0, restricted: 0 }], []];
    }
    if (sql.includes("SELECT COUNT(*) AS total")) return [[{ total: visible(sql, values).length }], []];
    if (sql.includes("FROM documents d")) {
      const match = sql.match(/LIMIT (\d+) OFFSET (\d+)/);
      assert.ok(match);
      const start = Number(match[2]);
      return [visible(sql, values).slice(start, start + Number(match[1])).map((f) => row(f, sql)), []];
    }
    throw new Error(`Unexpected mock SQL: ${sql}`);
  });
  t.mock.method(pool, "execute", async () => { throw new Error("Unexpected real-DB execution path"); });
  const connection = {
    async beginTransaction() { transactions += 1; },
    async query(sql: string, values: unknown[]) {
      if(sql.includes("SELECT file_path AS storagePath")) {
        const f=documents.find(item=>item.id===String(values[0]));
        return [f ? [{storagePath:`public/uploads/documents/${f.id}.pdf`,memberId:f.memberId,accessLevel:f.accessLevel,category:f.category,documentType:f.documentType,fileName:`synthetic-${f.id}.pdf`,mimeType:"application/pdf"}] : [],[]];
      }
      if(sql.includes("FROM finance_manual_evidence_links") || sql.includes("FROM finance_evidence_upload_intents")) {
        if(evidenceError) throw Object.assign(new Error("synthetic database error"),{code:evidenceError});
        return [evidenceIds.includes(String(values[0])) ? [{found:1}] : [],[]];
      }
      writes.push({ sql, values }); return [{ affectedRows: 1 }, []];
    },
    async commit() { commits += 1; },
    async rollback() {},
    release() {},
  } as unknown as PoolConnection;
  t.mock.method(pool, "getConnection", async () => connection);
  const read = t.mock.method(storageProvider(), "get", async () => Buffer.from("%PDF-synthetic"));
  const auth: AuthContext = {
    sessionId: "synthetic-session", tokenHash: "synthetic-hash",
    user: { id: "1", role, displayName: "Synthetic account", email: "synthetic@example.test", username: "synthetic" },
  };
  const service = { async authenticate(token?: string) {
    if (token !== "synthetic-token") throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    return auth;
  } } as AuthService;
  const app = express();
  app.use(cookieParser()); app.use(express.json());
  app.use("/api", createRecordsRouter(service)); app.use(errorHandler);
  const get = (url: string, authenticated = true) => {
    const req = request(app).get(url);
    return authenticated ? req.set("Cookie", `${env.SESSION_COOKIE_NAME}=synthetic-token`) : req;
  };
  return { app, get, queries, writes, read, counters: () => ({ historyReads, transactions, commits }) };
}

test("direct document file rejects evidence-linked documents without reading general storage",async t=>{
  const api=setup(t,"chairman","101",fixtures,["1"]);
  const response=await api.get("/api/documents/1/file?action=download");
  assert.equal(response.status,404);
  assert.equal(api.read.mock.callCount(),0);
});

test("ordinary file access survives missing additive evidence tables but not other lookup errors",async t=>{
  const legacy=setup(t,"chairman","101",fixtures,[],"ER_NO_SUCH_TABLE");
  assert.equal((await legacy.get("/api/documents/1/file?action=download")).status,200);
  assert.equal(legacy.read.mock.callCount(),1);
});

test("evidence lookup errors do not fall through to general storage",async t=>{
  const api=setup(t,"chairman","101",fixtures,[],"ER_LOCK_WAIT_TIMEOUT");
  assert.equal((await api.get("/api/documents/1/file?action=download")).status,500);
  assert.equal(api.read.mock.callCount(),0);
});

for (const [label, owner] of [["True Member", "101"], ["Associate Member", "202"]] as const) {
  test(`${label} list, counts, summary and uploader facets expose only permitted documents`, async (t) => {
    const api = setup(t, "member", owner);
    const response = await api.get("/api/documents?pageSize=100");
    assert.equal(response.status, 200);
    const expected = owner === "101" ? ["1", "2", "7"] : ["1", "3"];
    assert.deepEqual(response.body.documents.map((d: { id: string }) => d.id), expected);
    assert.equal(response.body.total, expected.length);
    assert.equal(response.body.summary.total, expected.length);
    assert.deepEqual(response.body.filterOptions.uploaders.map((u: { id: string }) => u.id), expected.map((id) => fixtures.find((f) => f.id === id)!.uploadedById));
    assert.equal(JSON.stringify(response.body).includes("Private detail 4"), false);
    assert.equal(api.read.mock.callCount(), 0);
  });
}

test("member without a linked profile lists only public documents", async (t) => {
  const api = setup(t, "member", null);
  const response = await api.get("/api/documents");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.documents.map((d: { id: string }) => d.id), ["1"]);
});

for (const [label, memberId, ownId, otherId] of [
  ["True Member A", "101", "2", "3"],
  ["Associate Member B", "202", "3", "2"],
  ["large member identity", "9007199254740993", "9", "8"],
] as const) {
  test(`${label} can open own document but cannot substitute another document ID`, async (t) => {
    const api = setup(t, "member", memberId);
    const own = await api.get(`/api/documents/${ownId}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.title, `Synthetic document ${ownId}`);
    assert.deepEqual(own.body.accessHistory, []);
    assert.deepEqual(own.body.auditHistory, []);
    assert.equal("memberId" in own.body, false, "keep ownership internal; do not expand the response contract");
    const reads = api.counters().historyReads;
    const foreign = await api.get(`/api/documents/${otherId}`);
    const unknown = await api.get("/api/documents/999999");
    const ownerless = await api.get("/api/documents/4");
    for (const denied of [foreign, unknown, ownerless]) {
      assert.equal(denied.status, 404);
      assert.deepEqual(denied.body, { error: "Document not found.", code: "DOCUMENT_NOT_FOUND" });
    }
    assert.equal(api.counters().historyReads, reads, "deny before audit-history retrieval");
    assert.equal(api.read.mock.callCount(), 0);
  });
}

for (const action of ["preview", "download", "print"]) {
  test(`direct-file ${action} denies foreign/ownerless IDs before storage or logging`, async (t) => {
    const api = setup(t);
    for (const id of ["3", "4", "5", "6", "999999", "2%20OR%201=1"]) {
      const denied = await api.get(`/api/documents/${id}/file?action=${action}`);
      assert.equal(denied.status, 404);
      assert.deepEqual(denied.body, { error: "Document not found.", code: "DOCUMENT_NOT_FOUND" });
      assert.equal(denied.headers["content-disposition"], undefined);
    }
    assert.equal(api.read.mock.callCount(), 0);
    assert.deepEqual(api.writes, []);
    assert.equal(api.counters().transactions, 0);
  });
  test(`authorized personal ${action} retains protected storage, access log and audit`, async (t) => {
    const api = setup(t);
    const response = await api.get(`/api/documents/2/file?action=${action}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.match(response.headers["content-disposition"], action === "download" ? /^attachment/ : /^inline/);
    assert.equal(api.read.mock.callCount(), 1);
    assert.deepEqual(api.read.mock.calls[0].arguments[0], { key: "documents/2.pdf", visibility: "protected" });
    assert.ok(api.writes.some((w) => w.sql.includes("INSERT INTO document_access_logs") && w.values[0] === "2"));
    assert.ok(api.writes.some((w) => w.sql.includes("INSERT INTO audit_logs")));
    assert.deepEqual(api.counters(), { historyReads: 0, transactions: 1, commits: 1 });
  });
}

test("anonymous public file works; private files and authenticated-only routes remain protected", async (t) => {
  const api = setup(t);
  const publicFile = await api.get("/api/documents/1/file", false);
  assert.equal(publicFile.status, 200);
  const readCount = api.read.mock.callCount();
  for (const id of ["2", "3", "4", "5", "6"]) {
    const denied = await api.get(`/api/documents/${id}/file?action=download`, false);
    assert.equal(denied.status, 404);
    assert.deepEqual(denied.body, { error: "Document not found.", code: "DOCUMENT_NOT_FOUND" });
  }
  assert.equal(api.read.mock.callCount(), readCount);
  for (const path of ["/api/documents", "/api/documents/1", "/api/documents/export"]) {
    assert.equal((await api.get(path, false)).status, 401);
  }
});

test("members cannot bypass staff-only export with query parameters", async (t) => {
  const api = setup(t);
  const response = await api.get("/api/documents/export?accessLevel=PUBLIC&memberId=202&role=chairman");
  assert.equal(response.status, 403);
  assert.equal(api.queries.length, 0);
  assert.equal(api.writes.length, 0);
});

for (const role of ["chairman", "bookkeeper"] as const) {
  test(`${role} list, detail, direct file and register export retain their authorized scope`, async (t) => {
    const api = setup(t, role);
    const expected = role === "chairman" ? fixtures.map((f) => f.id) : ["1", "2", "3", "4", "6", "8", "9"];
    const list = await api.get("/api/documents");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.documents.map((d: { id: string }) => d.id), expected);
    for (const id of expected) {
      assert.equal((await api.get(`/api/documents/${id}`)).status, 200);
      assert.equal((await api.get(`/api/documents/${id}/file`)).status, 200);
    }
    if (role === "bookkeeper") {
      assert.equal((await api.get("/api/documents/5")).status, 404);
      assert.equal((await api.get("/api/documents/7/file")).status, 404);
    }
    const csv = await api.get("/api/documents/export");
    assert.equal(csv.status, 200);
    for (const id of expected) assert.ok(csv.text.includes(`"DOC-${id}"`));
    for (const f of fixtures.filter((f) => !expected.includes(f.id))) assert.ok(!csv.text.includes(`"DOC-${f.id}"`));
    assert.ok(api.writes.some((w) => w.sql.includes("document.register_exported")));
  });
}

test("staff register export applies visibility again on every page", async (t) => {
  const documents = [...fixtures, ...Array.from({ length: 105 }, (_, i): Fixture => ({
    id: String(i + 100), accessLevel: "Member-only", memberId: "101", category: "FINANCIAL", documentType: "Receipt", uploadedById: "12",
  }))];
  const api = setup(t, "bookkeeper", null, documents);
  const csv = await api.get("/api/documents/export");
  assert.equal(csv.status, 200);
  assert.ok(csv.text.includes('"DOC-204"'));
  assert.ok(!csv.text.includes('"DOC-5"'));
  assert.ok(!csv.text.includes('"DOC-7"'));
  assert.equal(api.queries.filter((q) => /LIMIT 100 OFFSET/.test(q.sql)).length, 2);
});
