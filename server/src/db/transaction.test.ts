import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { withTransaction } from "./transaction";

function createTransactionDouble() {
  const calls: string[] = [];
  const connection = {
    async beginTransaction() {
      calls.push("begin");
    },
    async commit() {
      calls.push("commit");
    },
    async rollback() {
      calls.push("rollback");
    },
    release() {
      calls.push("release");
    },
  };
  const pool = {
    async getConnection() {
      calls.push("connect");
      return connection;
    },
  } as unknown as Pick<Pool, "getConnection">;

  return { calls, pool };
}

test("withTransaction commits successful work and releases the connection", async () => {
  const { calls, pool } = createTransactionDouble();
  const result = await withTransaction(async () => "saved", pool);

  assert.equal(result, "saved");
  assert.deepEqual(calls, ["connect", "begin", "commit", "release"]);
});

test("withTransaction rolls back failed work and releases the connection", async () => {
  const { calls, pool } = createTransactionDouble();

  await assert.rejects(
    withTransaction(async () => {
      throw new Error("write failed");
    }, pool),
    /write failed/,
  );
  assert.deepEqual(calls, ["connect", "begin", "rollback", "release"]);
});
