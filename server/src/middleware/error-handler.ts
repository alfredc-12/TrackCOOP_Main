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

  let appError = error instanceof AppError ? error : null;
  if (!appError && error && typeof error === "object" && "name" in error && error.name === "MulterError") {
    appError = new AppError((error as Error).message || "File upload error", 400, "FILE_UPLOAD_ERROR");
  }
  if (!appError) {
    appError = new AppError("An unexpected error occurred", 500, "INTERNAL_ERROR");
  }

  const logMeta = {
    requestId: request.requestId,
    method: request.method,
    path: request.originalUrl,
    statusCode: appError.statusCode,
    errorName: error instanceof Error ? error.name : "UnknownError",
  };

  if (appError.statusCode >= 500) {
    logger.error(`[${request.requestId}] Internal server error`, {
      ...logMeta,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const fs = require('fs');
    const path = require('path');
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(path.join(process.cwd(), '..', 'error.log'), new Date().toISOString() + '\n' + msg + '\n\n');
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
