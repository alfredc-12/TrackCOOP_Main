export const logger = {
  info(message: string, meta?: unknown) {
    console.info(`[TrackCOOP] ${message}`, meta ?? "");
  },
  error(message: string, meta?: unknown) {
    console.error(`[TrackCOOP] ${message}`, meta ?? "");
  },
};
