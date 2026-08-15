import crypto from "node:crypto";
import { AppError } from "../../utils/app-error";

export function generateApplicationTrackingToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashApplicationTrackingToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function requireApplicationTrackingToken(rawToken: string | undefined) {
  if (!rawToken?.trim()) {
    throw new AppError(
      "Application tracking token is required",
      401,
      "APPLICATION_TRACKING_TOKEN_REQUIRED",
    );
  }
  return rawToken.trim();
}

export function verifyApplicationTrackingToken(expectedHash: string, rawToken: string) {
  const actualHash = hashApplicationTrackingToken(rawToken);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

export function requireApplicationBirthDateCredential(rawDateOfBirth: string | undefined) {
  const value = rawDateOfBirth?.trim();
  if (!value) {
    throw new AppError(
      "Applicant date of birth is required",
      401,
      "APPLICATION_BIRTH_DATE_REQUIRED",
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(
      "Applicant date of birth must use YYYY-MM-DD format",
      400,
      "APPLICATION_BIRTH_DATE_INVALID",
    );
  }

  return value;
}

export function verifyApplicationBirthDate(
  expectedDateOfBirth: string | null | undefined,
  rawDateOfBirth: string,
) {
  return expectedDateOfBirth === rawDateOfBirth;
}
