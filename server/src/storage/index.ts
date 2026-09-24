import { env } from "../config/env";
import { LocalStorageProvider } from "./local-storage-provider";
import { S3StorageProvider } from "./s3-storage-provider";
import type { StorageProvider } from "./storage-provider";

let provider: StorageProvider | null = null;

export function createStorageProvider(): StorageProvider {
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
