import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { createCentralDocument } from "./central-document";

test("central document persists source identity in the caller's transaction", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const connection = {
    execute: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      return [{ insertId: 27 }, []];
    },
  } as unknown as PoolConnection;
  const result = await createCentralDocument(connection, {
    uploadedBy: "12", memberId: "34", title: "Synthetic receipt", category: "Payment Receipt",
    documentType: "Receipt", accessLevel: "Member-only", storagePath: "protected/fixture.pdf",
    relatedModule: "Payment", relatedRecordId: "56", relatedRecordReference: "REF-56",
    relationshipType: "Payment Receipt",
  });
  assert.equal(result.documentId, 27);
  assert.match(calls[0].sql, /related_module,\s+related_record_id, related_record_reference, relationship_type/);
  assert.deepEqual(calls[0].values.slice(-4), ["Payment", "56", "REF-56", "Payment Receipt"]);
  assert.equal((calls[0].sql.match(/\?/g) ?? []).length, calls[0].values.length);
  assert.match(calls[1].sql, /document\.module_linked/);
  assert.equal(calls[1].values[1], 27);
});

test("central document does not audit a link when the document insert fails", async () => {
  let calls = 0;
  const connection = { execute: async () => { calls++; throw new Error("insert failed"); } } as unknown as PoolConnection;
  await assert.rejects(createCentralDocument(connection, {
    title: "Synthetic", category: "Receipt", documentType: "Receipt", accessLevel: "Admin-only",
    storagePath: "protected/fixture.pdf", relatedModule: "Payment", relatedRecordId: "56",
    relationshipType: "Payment Receipt",
  }));
  assert.equal(calls, 1);
});
