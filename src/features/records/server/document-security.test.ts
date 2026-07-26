import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_DOCUMENT_FILE_SIZE } from "../record-constants";
import {
  safeOriginalFileName,
  resolveProtectedDocumentPath,
  validateDocumentFile,
  type UploadedFileLike,
} from "./document-security";

function uploaded(name: string, buffer: Buffer, type = ""): UploadedFileLike {
  return {
    name,
    size: buffer.length,
    type,
    async arrayBuffer() {
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    },
  };
}

describe("document file validation", () => {
  it("accepts a PDF based on its content signature, not browser MIME alone", async () => {
    const file = uploaded(
      "statement.pdf",
      Buffer.from("%PDF-1.4\nverification"),
      "application/octet-stream",
    );
    const result = await validateDocumentFile(file);
    assert.equal(result.extension, "pdf");
    assert.equal(result.mimeType, "application/pdf");
    assert.equal(result.checksum.length, 64);
  });

  it("rejects extension and content mismatches", async () => {
    const file = uploaded(
      "unsafe.pdf",
      Buffer.from("MZ executable-like content"),
      "application/pdf",
    );
    await assert.rejects(validateDocumentFile(file), /contents do not match/i);
  });

  it("rejects files over the centralized size limit", async () => {
    await assert.rejects(
      validateDocumentFile({
        name: "oversized.pdf",
        size: MAX_DOCUMENT_FILE_SIZE + 1,
        type: "application/pdf",
        async arrayBuffer() {
          return new ArrayBuffer(0);
        },
      }),
      /10 MB or smaller/,
    );
  });

  it("normalizes submitted file names", () => {
    assert.equal(
      safeOriginalFileName("../folder/  report   file.pdf"),
      "report file.pdf",
    );
  });

  it("rejects protected-storage path traversal", () => {
    assert.throws(
      () => resolveProtectedDocumentPath("../../private.pdf"),
      /protected storage|stay inside/i,
    );
  });
});
