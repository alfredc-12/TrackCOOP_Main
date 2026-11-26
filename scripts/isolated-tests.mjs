import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Pass only OS process-launch settings, never application credentials or opt-in SQL flags.
const safe = {};
for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "COMSPEC", "ComSpec", "PATHEXT", "TEMP", "TMP", "TMPDIR", "CI"]) {
  if (process.env[key] !== undefined) safe[key] = process.env[key];
}
const root = mkdtempSync(path.join(tmpdir(), "trackcoop-isolated-tests-"));
Object.assign(safe, {
  NODE_ENV: "test",
  TRACKCOOP_ISOLATED_TEST: "1",
  STORAGE_DRIVER: "local",
  LOCAL_STORAGE_ROOT: root,
  DB_HOST: "127.0.0.1",
  DB_PORT: "1",
  DB_NAME: "trackcoop_synthetic_test",
  DB_USER: "synthetic_test",
  DB_PASSWORD: "",
  DB_SSL: "false",
  PAYMONGO_ENABLED: "false",
  PAYMONGO_MODE: "test",
  AWS_EC2_METADATA_DISABLED: "true",
  NEXT_TELEMETRY_DISABLED: "1",
});
const args = process.argv.slice(2);
if (args[0] === "--evidence-mysql") {
  const [, port, dataDir] = args.splice(0, 3);
  if (!/^\d{4,5}$/.test(port ?? "") || Number(port) > 65535 || !dataDir || path.basename(dataDir).toLowerCase() !== "data" || !path.basename(path.dirname(dataDir)).toLowerCase().startsWith("trackcoop-budget-1b-synthetic-")) {
    throw new Error("Evidence SQL tests require an explicit isolated port and synthetic data directory");
  }
  Object.assign(safe, { EVIDENCE_ISOLATED_MYSQL: "1", EVIDENCE_TEST_PORT: port, EVIDENCE_TEST_DATADIR: dataDir });
  if (args[0] === "--evidence-schema") {
    args.shift();
    const exportPath = args.shift();
    if (!exportPath || !path.isAbsolute(exportPath)) throw new Error("An absolute structure export path is required");
    safe.EVIDENCE_SCHEMA_EXPORT = exportPath;
  }
}
try {
  const cli = path.resolve("node_modules/tsx/dist/cli.mjs");
  const child = spawnSync(process.execPath, [cli, "--test", ...args], {
    env: safe,
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
} finally {
  rmSync(root, { recursive: true, force: true });
}
