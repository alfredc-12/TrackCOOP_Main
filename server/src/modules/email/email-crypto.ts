import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One 32-byte master key (EMAIL_SECRET_KEY) yields independent sub-keys, so a leak of one purpose
 * (for example a receipt-link signature) says nothing about the other.
 */
function subKey(master: Buffer, purpose: string) {
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), `trackcoop-email:${purpose}`, 32));
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** AES-256-GCM. The row's dedupe key is bound in as associated data, so a blob cannot be moved to another row. */
export function encryptSecret(plaintext: string, master: Buffer, associatedData: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", subKey(master, "outbox-secret"), iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptSecret(blob: Buffer, master: Buffer, associatedData: string) {
  if (blob.length < IV_BYTES + TAG_BYTES + 1) throw new Error("Encrypted payload is too short");
  const decipher = createDecipheriv("aes-256-gcm", subKey(master, "outbox-secret"), blob.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(blob.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}

const base64Url = (value: Buffer) => value.toString("base64url");

function receiptSignature(master: Buffer, signed: string) {
  return createHmac("sha256", subKey(master, "receipt-link")).update(signed).digest();
}

export const RECEIPT_LINK_DAYS = 30;

/** Stateless, expiring link token for one receipt: `v1.<receiptId>.<expiresEpoch>.<signature>`. */
export function signReceiptToken(receiptId: string, expiresAtEpochSeconds: number, master: Buffer) {
  const signed = `v1.${receiptId}.${expiresAtEpochSeconds}`;
  return `${signed}.${base64Url(receiptSignature(master, signed))}`;
}

export function verifyReceiptToken(token: string, master: Buffer, nowEpochSeconds: number) {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || !/^\d{1,20}$/.test(parts[1]) || !/^\d{1,12}$/.test(parts[2])) return null;
  const expected = receiptSignature(master, `v1.${parts[1]}.${parts[2]}`);
  let provided: Buffer;
  try {
    provided = Buffer.from(parts[3], "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  if (Number(parts[2]) <= nowEpochSeconds) return null;
  return { receiptId: parts[1] };
}
