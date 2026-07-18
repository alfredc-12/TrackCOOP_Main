type LogMeta = Record<string, string | number | boolean | null | undefined>;

function serialize(meta?: LogMeta) {
  return meta ? ` ${JSON.stringify(meta)}` : "";
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.info(`[TrackCOOP API] ${message}${serialize(meta)}`);
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(`[TrackCOOP API] ${message}${serialize(meta)}`);
  },
  error(message: string, meta?: LogMeta) {
    console.error(`[TrackCOOP API] ${message}${serialize(meta)}`);
  },
};
