import type { Response } from "express";
import type { ApiFailure, ApiSuccess } from "../types/api";

export function sendSuccess<T>(
  response: Response,
  data: T,
  options: {
    statusCode?: number;
    message?: string;
    meta?: Record<string, unknown>;
  } = {},
) {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
    message: options.message ?? "",
    meta: options.meta ?? {},
  };

  return response.status(options.statusCode ?? 200).json(payload);
}

export function sendFailure(
  response: Response,
  payload: ApiFailure,
  statusCode: number,
) {
  return response.status(statusCode).json(payload);
}
