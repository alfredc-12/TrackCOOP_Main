export type StorageVisibility = "public" | "protected";

export type StoredFile = {
  key: string;
  path: string;
  url?: string;
  contentType?: string;
  size?: number;
};

export type PutObjectInput = {
  key: string;
  body: Buffer;
  visibility: StorageVisibility;
  contentType?: string;
};

export type GetObjectInput = {
  key: string;
  visibility: StorageVisibility;
};

export interface StorageProvider {
  put(input: PutObjectInput): Promise<StoredFile>;
  get(input: GetObjectInput): Promise<Buffer>;
  delete(input: GetObjectInput): Promise<void>;
  exists?(input: GetObjectInput): Promise<boolean>;
  getDownloadUrl?(input: GetObjectInput & { expiresInSeconds?: number }): Promise<string>;
}

