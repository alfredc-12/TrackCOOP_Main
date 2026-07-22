import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

export const notFound: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      `Route not found: ${request.method} ${request.originalUrl}`,
      404,
      "ROUTE_NOT_FOUND",
    ),
  );
};
