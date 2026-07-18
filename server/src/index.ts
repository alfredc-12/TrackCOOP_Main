import { app } from "./app";
import { env } from "./config/env";
import { closePool } from "./db/pool";
import { logger } from "./utils/logger";

const server = app.listen(env.API_PORT, () => {
  logger.info("server started", {
    environment: env.NODE_ENV,
    port: env.API_PORT,
  });
});

function shutdown(signal: string) {
  logger.info("shutdown requested", { signal });

  server.close(async (error) => {
    if (error) {
      logger.error("server shutdown failed", { errorName: error.name });
      process.exitCode = 1;
      return;
    }

    try {
      await closePool();
    } catch (poolError) {
      logger.error("database pool shutdown failed", {
        errorName: poolError instanceof Error ? poolError.name : "UnknownError",
      });
      process.exitCode = 1;
    }

    logger.info("server stopped");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
