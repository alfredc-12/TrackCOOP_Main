import assert from "node:assert/strict";
import test from "node:test";
import { expectedDatabaseTables } from "./expected-tables";
import { compareDatabaseTables } from "./schema-check";

test("compareDatabaseTables accepts the authoritative 34-table schema", () => {
  const result = compareDatabaseTables(expectedDatabaseTables);

  assert.equal(result.expectedCount, 34);
  assert.equal(result.actualCount, 34);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.missingTables, []);
  assert.deepEqual(result.unexpectedTables, []);
});

test("compareDatabaseTables identifies missing and additional tables", () => {
  const result = compareDatabaseTables([
    ...expectedDatabaseTables.filter((tableName) => tableName !== "audit_logs"),
    "legacy_table",
  ]);

  assert.equal(result.isComplete, false);
  assert.deepEqual(result.missingTables, ["audit_logs"]);
  assert.deepEqual(result.unexpectedTables, ["legacy_table"]);
});
