import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const server = app.listen(env.API_PORT, () => {
  logger.info("server started", {
    environment: env.NODE_ENV,
    port: env.API_PORT,
  });
});

function shutdown(signal: string) {
  logger.info("shutdown requested", { signal });

  server.close((error) => {
    if (error) {
      logger.error("server shutdown failed", { errorName: error.name });
      process.exitCode = 1;
      return;
    }

    logger.info("server stopped");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
