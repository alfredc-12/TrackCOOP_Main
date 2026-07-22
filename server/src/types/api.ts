export type ApiErrorDetail = {
  code?: string;
  field?: string;
  message: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
  meta: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors: ApiErrorDetail[];
};
