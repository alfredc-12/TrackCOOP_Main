/**
 * Cron entry point: one short run of the email outbox, then exit.
 *
 *   node server/dist/scripts/run-email-outbox.js
 *   node server/dist/scripts/run-email-outbox.js --check-config      (validates configuration, sends nothing)
 *   node server/dist/scripts/run-email-outbox.js --release-blocked=12,13   (explicit release of Blocked rows)
 *
 * Configuration comes from the process environment, or from the file named by TRACKCOOP_WORKER_ENV_FILE
 * (see config/worker-env.ts). Output is counts only: never recipients, messages, links or keys.
 */
import { loadWorkerEnvFile, WorkerEnvError } from "../config/worker-env";

async function main() {
  const file = process.env.TRACKCOOP_WORKER_ENV_FILE;
  if (file) loadWorkerEnvFile(file);

  // Imported only now, so these modules read the environment after the worker file has been applied.
  const [{ env }, { emailConfigFromEnv }, { closePool, getPool }, { runOutboxOnce }, { createOutboxStore }] = await Promise.all([
    import("../config/env"),
    import("../modules/email/email-config"),
    import("../db/pool"),
    import("../modules/email/email-outbox.worker"),
    import("../modules/email/email-outbox.repository"),
  ]);
  const config = emailConfigFromEnv(env);
  const args = process.argv.slice(2);

  if (args.includes("--check-config")) {
    console.info(JSON.stringify({
      mode: config.mode,
      stage: config.stage,
      allowlistEntries: config.allowlist.length,
      hasApiKey: Boolean(config.resendApiKey),
      hasFromAddress: Boolean(config.fromAddress),
      hasReplyTo: Boolean(config.replyTo),
      hasSecretKey: Boolean(config.secretKey),
      hasApiPublicUrl: Boolean(config.apiPublicUrl),
      configFileUsed: Boolean(file),
    }));
    return;
  }

  try {
    const release = args.find((arg) => arg.startsWith("--release-blocked="));
    if (release) {
      const ids = release.slice("--release-blocked=".length).split(",").map((id) => id.trim()).filter((id) => /^\d{1,20}$/.test(id));
      const released = await createOutboxStore(getPool()).releaseBlocked(ids, config.stage);
      console.info(JSON.stringify({ released }));
      return;
    }
    const summary = await runOutboxOnce({ pool: getPool(), config });
    console.info(JSON.stringify(summary));
    if (summary.systemic) process.exitCode = 2;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  // The message only; never the stack, which can include connection details.
  console.error("Email outbox run failed:", error instanceof WorkerEnvError || error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
