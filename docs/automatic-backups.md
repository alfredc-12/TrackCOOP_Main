# Automatic database backups

TrackCOOP includes an optional server-side backup scheduler for the MySQL database. It creates a timestamped `.sql` dump and removes backups older than the configured retention period.

The scheduler is disabled by default. A Chairman can enable it from **System → Settings → Database Backups** after configuring a protected backup destination. The same settings screen can change the interval and retention period without editing environment variables.

```env
BACKUP_ENABLED=true
BACKUP_DIR=/secure/trackcoop-backups
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=14
MYSQLDUMP_PATH=/usr/bin/mysqldump
```

The Chairman settings override the interval, retention, and enabled state after they are saved. The environment values are used as fallbacks when no saved backup setting exists. The scheduler uses the existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings. Keep the backup directory and `MYSQLDUMP_PATH` server-managed; they are intentionally not editable in the browser, and credentials are never exposed in Settings.

The **Back up now** button in the same Settings category creates a fresh dump immediately and downloads the `.sql` file to the Chairman's browser. Manual backup is available even when automatic scheduling is disabled. If S3-compatible storage is configured, the same dump is also copied there.

The backup is a MySQL database dump only. It does not include uploaded images or other media files. Keep the backup directory outside the application source tree, restrict its filesystem permissions, and copy backups to a separate storage location for disaster recovery. A backup is not a substitute for restore testing, so periodically verify that a dump can be restored in a non-production database.

For hosted production, configure a separate private S3-compatible bucket for an off-server copy:

```env
BACKUP_S3_BUCKET=trackcoop-database-backups
BACKUP_S3_PREFIX=database-backups
```

The upload reuses the existing `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE` settings. Configure bucket encryption, restricted access, versioning, and a lifecycle/retention rule in the object-storage provider. The local `.sql` file remains in `BACKUP_DIR` as well, so use a persistent disk and monitor its capacity.
