import { env } from "../config/env";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorageProvider } from "./local-storage-provider";
import { S3StorageProvider } from "./s3-storage-provider";
import type { StorageProvider } from "./storage-provider";

let provider: StorageProvider | null = null;

export function createStorageProvider(): StorageProvider {
  if (process.env.NODE_TEST_CONTEXT) {
    if (env.STORAGE_DRIVER !== "local") {
      throw new Error("Tests must use isolated local storage; refusing configured remote storage");
    }
    let relative: string;
    try {
      relative = path.relative(realpathSync(tmpdir()), realpathSync(env.LOCAL_STORAGE_ROOT));
    } catch {
      throw new Error("Test storage root must be an existing isolated temporary directory");
    }
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Test storage root must be an isolated temporary directory");
    }
  }
  return env.STORAGE_DRIVER === "s3"
    ? new S3StorageProvider()
    : new LocalStorageProvider();
}

export function storageProvider() {
  provider ??= createStorageProvider();
  return provider;
}

export function resetStorageProviderForTests() {
  provider = null;
}

export * from "./storage-provider";
export * from "./storage-paths";
