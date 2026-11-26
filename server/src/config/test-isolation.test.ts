import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { getPool } from "../db/pool";
import { createStorageProvider } from "../storage";
import { env } from "./env";

test("isolated runner does not inherit application credentials or optional SQL tests", async () => {
  assert.equal(process.env.TRACKCOOP_ISOLATED_TEST, "1", "use the isolated test runner");
  assert.equal(env.STORAGE_DRIVER, "local");
  const relative = path.relative(realpathSync(tmpdir()), realpathSync(env.LOCAL_STORAGE_ROOT));
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  for (const key of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "PAYMONGO_SECRET_KEY", "RESEND_API_KEY", "EVIDENCE_ISOLATED_MYSQL"]) {
    assert.equal(process.env[key], undefined, `${key} must not enter the test worker`);
  }
  assert.ok(createStorageProvider());
  await assert.rejects(getPool().query("SELECT 1"), /unavailable in tests/);
});
