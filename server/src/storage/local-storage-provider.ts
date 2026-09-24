import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import type { GetObjectInput, PutObjectInput, StoredFile, StorageProvider } from "./storage-provider";
import { normalizeObjectKey, providerObjectKey, publicUrlPath } from "./storage-paths";

export class LocalStorageProvider implements StorageProvider {
  readonly root: string;

  constructor(root = env.LOCAL_STORAGE_ROOT) {
    this.root = path.resolve(process.cwd(), root);
  }

  private absolutePath(key: string, visibility: "public" | "protected") {
    const objectKey = providerObjectKey(key, visibility);
    const absolute = path.resolve(this.root, objectKey);
    const allowedRoot = `${this.root}${path.sep}`;
    if (absolute !== this.root && !absolute.startsWith(allowedRoot)) {
      throw new Error("Storage path escaped the configured storage root.");
    }
    return absolute;
  }

  private legacyAbsolutePath(key: string) {
    return path.resolve(process.cwd(), "public", "uploads", normalizeObjectKey(key));
  }

  async put(input: PutObjectInput): Promise<StoredFile> {
    const absolute = this.absolutePath(input.key, input.visibility);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.body);
    const key = normalizeObjectKey(input.key);
    return {
      key,
      path: input.visibility === "public" ? publicUrlPath(key) : `public/uploads/${key}`,
      url: input.visibility === "public" ? publicUrlPath(key) : undefined,
      contentType: input.contentType,
      size: input.body.length,
    };
  }

  async get(input: GetObjectInput): Promise<Buffer> {
    const absolute = this.absolutePath(input.key, input.visibility);
    try {
      return await readFile(absolute);
    } catch (error) {
      if (input.visibility === "protected") {
        return readFile(this.legacyAbsolutePath(input.key));
      }
      throw error;
    }
  }

  async delete(input: GetObjectInput): Promise<void> {
    await rm(this.absolutePath(input.key, input.visibility), { force: true });
    if (input.visibility === "protected") {
      await rm(this.legacyAbsolutePath(input.key), { force: true }).catch(() => undefined);
    }
  }

  async exists(input: GetObjectInput): Promise<boolean> {
    try {
      await access(this.absolutePath(input.key, input.visibility));
      return true;
    } catch {
      if (input.visibility === "protected") {
        try {
          await access(this.legacyAbsolutePath(input.key));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  publicRoot() {
    return path.join(this.root, "public");
  }
}

