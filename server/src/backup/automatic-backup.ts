import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";
import { getPool } from "../db/pool";
import { logger } from "../utils/logger";

type BackupScheduler = { stop: () => void };
type BackupConfig = {
  enabled: boolean;
  intervalHours: number;
  retentionDays: number;
};
type SettingRow = RowDataPacket & {
  settingKey: string;
  settingValue: string | null;
};

const settingKeys = [
  "backups.enabled",
  "backups.interval_hours",
  "backups.retention_days",
] as const;

function environmentConfig(): BackupConfig {
  return {
    enabled: process.env.BACKUP_ENABLED === "true",
    intervalHours: Math.min(
      8760,
      Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24)),
    ),
    retentionDays: Math.min(
      3650,
      Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14)),
    ),
  };
}

function readJsonSetting<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadBackupConfig(): Promise<BackupConfig> {
  const fallback = environmentConfig();
  try {
    const [rows] = await getPool().execute<SettingRow[]>(
      `SELECT setting_key AS settingKey, setting_value AS settingValue
       FROM system_settings
       WHERE setting_key IN (${settingKeys.map(() => "?").join(",")})`,
      [...settingKeys],
    );
    const values = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    const enabled = readJsonSetting(values.get("backups.enabled"), fallback.enabled);
    const intervalHours = readJsonSetting(
      values.get("backups.interval_hours"),
      fallback.intervalHours,
    );
    const retentionDays = readJsonSetting(
      values.get("backups.retention_days"),
      fallback.retentionDays,
    );
    return {
      enabled: typeof enabled === "boolean" ? enabled : fallback.enabled,
      intervalHours:
        typeof intervalHours === "number" && Number.isInteger(intervalHours)
          ? Math.min(8760, Math.max(1, intervalHours))
          : fallback.intervalHours,
      retentionDays:
        typeof retentionDays === "number" && Number.isInteger(retentionDays)
          ? Math.min(3650, Math.max(1, retentionDays))
          : fallback.retentionDays,
    };
  } catch (error) {
    logger.warn("backup settings could not be loaded; using environment defaults", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return fallback;
  }
}

function backupDirectory() {
  return path.resolve(
    process.env.BACKUP_DIR || path.join(process.cwd(), "database-backups"),
  );
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runDump(outputFile: string) {
  return new Promise<void>((resolve, reject) => {
    const password = process.env.DB_PASSWORD;
    const child = spawn(
      process.env.MYSQLDUMP_PATH || "mysqldump",
      [
        "--host", process.env.DB_HOST || "127.0.0.1",
        "--port", process.env.DB_PORT || "3306",
        "--user", process.env.DB_USER || "root",
        "--single-transaction",
        "--routines",
        "--triggers",
        "--events",
        "--hex-blob",
        "--databases", process.env.DB_NAME || "trackcoop",
        "--result-file", outputFile,
      ],
      {
        env: password ? { ...process.env, MYSQL_PWD: password } : process.env,
        windowsHide: true,
      },
    );

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `mysqldump exited with code ${code ?? "unknown"}`));
    });
  });
}

async function pruneBackups(directory: string, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = await readdir(directory);
  for (const file of files) {
    if (!file.startsWith("trackcoop-") || !file.endsWith(".sql")) continue;
    const filePath = path.join(directory, file);
    const fileStat = await stat(filePath).catch(() => null);
    if (fileStat && fileStat.mtimeMs < cutoff) await unlink(filePath);
  }
}

async function uploadBackupToObjectStorage(outputFile: string) {
  if (!env.BACKUP_S3_BUCKET) return null;

  const s3 = await import("@aws-sdk/client-s3");
  const client = new s3.S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  const prefix = env.BACKUP_S3_PREFIX.replace(/^\/+|\/+$/g, "");
  const objectKey = `${prefix}/${path.basename(outputFile)}`;
  try {
    await client.send(
      new s3.PutObjectCommand({
        Bucket: env.BACKUP_S3_BUCKET,
        Key: objectKey,
        Body: await readFile(outputFile),
        ContentType: "application/sql",
      }),
    );
    logger.info("database backup uploaded to object storage", {
      bucket: env.BACKUP_S3_BUCKET,
      objectKey,
    });
    return objectKey;
  } finally {
    client.destroy();
  }
}

export type DatabaseBackupResult = {
  outputFile: string;
  downloadName: string;
  objectKey: string | null;
};

async function createBackup(config: BackupConfig): Promise<DatabaseBackupResult> {
  const directory = backupDirectory();
  await mkdir(directory, { recursive: true });
  const outputFile = path.join(directory, `trackcoop-${timestamp()}.sql`);
  await runDump(outputFile);
  const objectKey = await uploadBackupToObjectStorage(outputFile);
  await pruneBackups(directory, config.retentionDays);
  logger.info("database backup completed", {
    directory,
    file: path.basename(outputFile),
  });
  return {
    outputFile,
    downloadName: path.basename(outputFile),
    objectKey,
  };
}

/** Create a fresh SQL dump for an authenticated manual download. */
export async function runManualDatabaseBackup() {
  return createBackup(await loadBackupConfig());
}

let reloadScheduler: (() => void) | null = null;

/** Re-read the persisted backup settings without exposing database credentials to the UI. */
export function requestAutomaticBackupReload() {
  reloadScheduler?.();
}

export function startAutomaticBackupScheduler(): BackupScheduler {
  if (process.env.NODE_ENV === "test") return { stop: () => undefined };

  let stopped = false;
  let running = false;
  let reloadRequested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastEnabled: boolean | undefined;

  const schedule = (intervalHours: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), intervalHours * 60 * 60 * 1000);
    timer.unref?.();
  };

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    let config = environmentConfig();
    try {
      config = await loadBackupConfig();
      if (config.enabled) {
        await createBackup(config);
      } else if (lastEnabled !== false) {
        logger.info("automatic database backup is disabled", {
          setting: "Chairman Settings > Database Backups",
        });
      }
      lastEnabled = config.enabled;
    } catch (error) {
      logger.error("database backup failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      running = false;
      if (reloadRequested && !stopped) {
        reloadRequested = false;
        void tick();
      } else {
        schedule(config.intervalHours);
      }
    }
  };

  const reload = () => {
    if (stopped) return;
    if (running) {
      reloadRequested = true;
      return;
    }
    if (timer) clearTimeout(timer);
    void tick();
  };

  reloadScheduler = reload;
  void tick();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (reloadScheduler === reload) reloadScheduler = null;
    },
  };
}
