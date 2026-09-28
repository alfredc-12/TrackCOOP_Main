import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDocumentFile } from "./rental-document-security";

function upload(name: string, type: string, buffer: Buffer) {
  return {
    name,
    size: buffer.length,
    type,
    async arrayBuffer() {
      const copy = new Uint8Array(buffer);
      return copy.buffer;
    },
  };
}

test("detects a PNG valid ID even when the file name says JPG", async () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]);

  const validated = await validateDocumentFile(
    upload("valid-id.jpg", "image/jpeg", png),
  );

  assert.equal(validated.extension, "png");
  assert.equal(validated.mimeType, "image/png");
});

test("detects a WEBP valid ID even when the file name says JPG", async () => {
  const webp = Buffer.from([
    0x52, 0x49, 0x46, 0x46,
    0x10, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20,
  ]);

  const validated = await validateDocumentFile(
    upload("valid-id.jpg", "image/jpeg", webp),
  );

  assert.equal(validated.extension, "webp");
  assert.equal(validated.mimeType, "image/webp");
});

test("accepts another real image type even with a generic file name", async () => {
  const gif = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x01, 0x00, 0x01, 0x00,
  ]);

  const validated = await validateDocumentFile(
    upload("valid-id.upload", "image/gif", gif),
  );

  assert.equal(validated.extension, "gif");
  assert.equal(validated.mimeType, "image/gif");
});
