import type { ApiErrorDetail } from "../types/api";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly errors: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    errors: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}
