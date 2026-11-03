import { readFileSync, statSync } from "node:fs";
import { parse } from "dotenv";

/**
 * The email worker runs from cron, which does not receive the variables set in cPanel's Node.js application
 * page. It reads them from one small file instead: owned by the account, readable by nobody else, outside the
 * web root, and containing only what the worker needs. Only these names are ever copied from that file, and
 * values are never logged.
 */
export const WORKER_ENV_KEYS = [
  "NODE_ENV",
  "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_SSL", "DB_SSL_CA_PATH", "DB_CONNECTION_LIMIT",
  "EMAIL_DELIVERY", "EMAIL_FROM_NAME", "EMAIL_FROM_ADDRESS", "EMAIL_REPLY_TO", "RESEND_API_KEY", "EMAIL_SECRET_KEY",
  "EMAIL_RELEASE_STAGE", "EMAIL_RECIPIENT_ALLOWLIST",
  "FRONTEND_URL", "API_PUBLIC_URL",
] as const;

export type WorkerEnvFileSystem = {
  stat: (path: string) => { mode: number; uid: number };
  read: (path: string) => string;
  platform: NodeJS.Platform;
  uid: number | undefined;
};

const realFileSystem = (): WorkerEnvFileSystem => ({
  stat: (path) => statSync(path),
  read: (path) => readFileSync(path, "utf8"),
  platform: process.platform,
  uid: typeof process.getuid === "function" ? process.getuid() : undefined,
});

export class WorkerEnvError extends Error {}

/** Returns the NAMES it set. Existing process variables always win, so a real environment is never overridden. */
export function loadWorkerEnvFile(
  filePath: string,
  target: NodeJS.ProcessEnv = process.env,
  fileSystem: WorkerEnvFileSystem = realFileSystem(),
) {
  let info: { mode: number; uid: number };
  try {
    info = fileSystem.stat(filePath);
  } catch {
    throw new WorkerEnvError("The worker environment file was not found or cannot be read.");
  }
  if (fileSystem.platform !== "win32") {
    if ((info.mode & 0o077) !== 0) {
      throw new WorkerEnvError("The worker environment file must not be readable by group or others (use chmod 600).");
    }
    if (fileSystem.uid !== undefined && info.uid !== fileSystem.uid) {
      throw new WorkerEnvError("The worker environment file must be owned by the account that runs the worker.");
    }
  }
  const values = parse(fileSystem.read(filePath));
  const allowed = new Set<string>(WORKER_ENV_KEYS);
  const set: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || target[key] !== undefined) continue;
    target[key] = value;
    set.push(key);
  }
  return set;
}
