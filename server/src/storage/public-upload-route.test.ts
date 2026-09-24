import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import request from "supertest";
import { createPublicUploadHandler } from "./public-upload-route";
import { LocalStorageProvider } from "./local-storage-provider";
import type { GetObjectInput, PutObjectInput, StoredFile, StorageProvider } from "./storage-provider";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

class FakeStorageProvider implements StorageProvider {
  readonly objects = new Map<string, Buffer>();
  readonly gets: GetObjectInput[] = [];

  constructor(entries: Array<{ key: string; visibility: "public" | "protected"; body: Buffer }> = []) {
    for (const entry of entries) {
      this.objects.set(`${entry.visibility}:${entry.key}`, entry.body);
    }
  }

  async put(input: PutObjectInput): Promise<StoredFile> {
    this.objects.set(`${input.visibility}:${input.key}`, input.body);
    return {
      key: input.key,
      path: input.visibility === "public" ? `/uploads/${input.key}` : `public/uploads/${input.key}`,
    };
  }

  async get(input: GetObjectInput): Promise<Buffer> {
    this.gets.push(input);
    const found = this.objects.get(`${input.visibility}:${input.key}`);
    if (!found) {
      const error = new Error("missing") as Error & { code: string };
      error.code = "NoSuchKey";
      throw error;
    }
    return found;
  }

  async delete(input: GetObjectInput): Promise<void> {
    this.objects.delete(`${input.visibility}:${input.key}`);
  }
}

function createUploadTestApp(provider: StorageProvider) {
  const app = express();
  app.use("/uploads", createPublicUploadHandler(provider));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const statusCode = error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : 500;
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "INTERNAL_ERROR";
    response.status(statusCode).json({ code });
  });
  app.use((_request, response) => {
    response.status(404).json({ message: "not found" });
  });
  return app;
}

test("public upload route returns a local public object", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "trackcoop-public-route-"));
  try {
    const provider = new LocalStorageProvider(root);
    await provider.put({
      key: "gallery/local.png",
      visibility: "public",
      body: Buffer.from("local public image"),
      contentType: "image/png",
    });

    const response = await request(createUploadTestApp(provider))
      .get("/uploads/gallery/local.png");

    assert.equal(response.status, 200);
    assert.equal(response.body.toString(), "local public image");
    assert.match(response.headers["content-type"], /^image\/png/);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("public upload route reads through public visibility only", async () => {
  const provider = new FakeStorageProvider([
    { key: "rentals/example.jpg", visibility: "public", body: Buffer.from("public") },
  ]);

  const response = await request(createUploadTestApp(provider))
    .get("/uploads/rentals/example.jpg");

  assert.equal(response.status, 200);
  assert.deepEqual(provider.gets.at(-1), {
    key: "rentals/example.jpg",
    visibility: "public",
  });
});

test("public upload route never returns protected objects", async () => {
  const provider = new FakeStorageProvider([
    { key: "rental-valid-ids/id.pdf", visibility: "protected", body: Buffer.from("private") },
  ]);

  const response = await request(createUploadTestApp(provider))
    .get("/uploads/rental-valid-ids/id.pdf");

  assert.equal(response.status, 404);
  assert.equal(provider.gets.length, 0);
});

test("public upload route rejects path traversal", async () => {
  const response = await request(createUploadTestApp(new FakeStorageProvider()))
    .get("/uploads/%2e%2e%2f%2e%2e%2fsecret.txt");

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_STORAGE_KEY");
});

test("missing public upload returns 404", async () => {
  const response = await request(createUploadTestApp(new FakeStorageProvider()))
    .get("/uploads/gallery/missing.jpg");

  assert.equal(response.status, 404);
});

test("public upload route returns safe content types for common assets", async () => {
  const provider = new FakeStorageProvider([
    { key: "gallery/photo.jpeg", visibility: "public", body: Buffer.from("jpg") },
    { key: "gallery/card.webp", visibility: "public", body: Buffer.from("webp") },
    { key: "gallery/scan.pdf", visibility: "public", body: Buffer.from("pdf") },
  ]);
  const app = createUploadTestApp(provider);

  assert.match((await request(app).get("/uploads/gallery/photo.jpeg")).headers["content-type"], /^image\/jpeg/);
  assert.match((await request(app).get("/uploads/gallery/card.webp")).headers["content-type"], /^image\/webp/);
  assert.match((await request(app).get("/uploads/gallery/scan.pdf")).headers["content-type"], /^application\/pdf/);
});

test("public upload route works for S3-style storage without a public base URL", async () => {
  const provider = new FakeStorageProvider([
    { key: "announcements/cloud.avif", visibility: "public", body: Buffer.from("cloud object") },
  ]);

  const response = await request(createUploadTestApp(provider))
    .get("/uploads/announcements/cloud.avif");

  assert.equal(response.status, 200);
  assert.equal(response.body.toString(), "cloud object");
  assert.deepEqual(provider.gets.at(-1), {
    key: "announcements/cloud.avif",
    visibility: "public",
  });
});
