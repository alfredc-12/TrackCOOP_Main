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
