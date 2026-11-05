/** Run daily before the existing outbox worker. Never run from a browser or request. */
import { loadWorkerEnvFile } from "../config/worker-env";
async function main() {
  if (process.env.TRACKCOOP_WORKER_ENV_FILE)
    loadWorkerEnvFile(process.env.TRACKCOOP_WORKER_ENV_FILE);
  const [{ getPool, closePool }, { enqueueCapitalReminders }] =
    await Promise.all([
      import("../db/pool"),
      import("../modules/membership-policy/capital-reminders"),
    ]);
  try {
    console.info(JSON.stringify(await enqueueCapitalReminders(getPool())));
  } finally {
    await closePool();
  }
}
main().catch(() => {
  console.error(
    "Capital reminder run failed; inspect configured database/worker availability.",
  );
  process.exitCode = 1;
});
