import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { sendFailure } from "../utils/response";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  void _next;

  if (!(error instanceof AppError)) {
    console.error("UNEXPECTED ERROR:", error);
    try { require('fs').writeFileSync('debug.log', String((error as any)?.stack || error)); } catch(e){}
  }
  
  const appError =
    error instanceof AppError
      ? error
      : new AppError("An unexpected error occurred", 500, "INTERNAL_ERROR");

  const logMeta = {
    requestId: request.requestId,
    method: request.method,
    path: request.originalUrl,
    statusCode: appError.statusCode,
    errorName: error instanceof Error ? error.name : "UnknownError",
  };

  if (appError.statusCode >= 500) {
    logger.error("request failed", logMeta);
  } else {
    logger.warn("request rejected", logMeta);
  }

  return sendFailure(
    response,
    {
      success: false,
      message: appError.message,
      errors:
        appError.errors.length > 0
          ? appError.errors
          : appError.code === "INTERNAL_ERROR"
            ? []
            : [{ code: appError.code, message: appError.message }],
    },
    appError.statusCode,
  );
};
