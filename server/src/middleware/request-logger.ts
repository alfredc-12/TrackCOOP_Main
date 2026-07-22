import type { RequestHandler } from "express";
import { logger } from "../utils/logger";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on("finish", () => {
    logger.info("request completed", {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  next();
};
