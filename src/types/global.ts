export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };
