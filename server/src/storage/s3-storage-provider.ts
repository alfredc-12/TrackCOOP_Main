import { env } from "../config/env";
import type { GetObjectInput, PutObjectInput, StoredFile, StorageProvider } from "./storage-provider";
import { normalizeObjectKey, providerObjectKey, publicUrlPath } from "./storage-paths";

type S3Module = typeof import("@aws-sdk/client-s3");
type PresignerModule = typeof import("@aws-sdk/s3-request-presigner");

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (body instanceof Uint8Array) return Buffer.from(body);
  const readable = body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export class S3StorageProvider implements StorageProvider {
  private clientPromise: Promise<{
    s3: S3Module;
    presigner: PresignerModule;
    client: InstanceType<S3Module["S3Client"]>;
  }>;

  constructor() {
    this.clientPromise = this.createClient();
  }

  private async createClient() {
    const [s3, presigner] = await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
    ]);
    const client = new s3.S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
    return { s3, presigner, client };
  }

  private bucket() {
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required for S3 storage.");
    return env.S3_BUCKET;
  }

  async put(input: PutObjectInput): Promise<StoredFile> {
    const { s3, client } = await this.clientPromise;
    const key = normalizeObjectKey(input.key);
    const objectKey = providerObjectKey(key, input.visibility);
    await client.send(new s3.PutObjectCommand({
      Bucket: this.bucket(),
      Key: objectKey,
      Body: input.body,
      ContentType: input.contentType,
    }));
    const publicUrl = input.visibility === "public"
      ? env.S3_PUBLIC_BASE_URL
        ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`
        : publicUrlPath(key)
      : undefined;
    return {
      key,
      path: input.visibility === "public" ? publicUrlPath(key) : `public/uploads/${key}`,
      url: publicUrl,
      contentType: input.contentType,
      size: input.body.length,
    };
  }

  async get(input: GetObjectInput): Promise<Buffer> {
    const { s3, client } = await this.clientPromise;
    const response = await client.send(new s3.GetObjectCommand({
      Bucket: this.bucket(),
      Key: providerObjectKey(input.key, input.visibility),
    }));
    return streamToBuffer(response.Body);
  }

  async delete(input: GetObjectInput): Promise<void> {
    const { s3, client } = await this.clientPromise;
    await client.send(new s3.DeleteObjectCommand({
      Bucket: this.bucket(),
      Key: providerObjectKey(input.key, input.visibility),
    }));
  }

  async exists(input: GetObjectInput): Promise<boolean> {
    const { s3, client } = await this.clientPromise;
    try {
      await client.send(new s3.HeadObjectCommand({
        Bucket: this.bucket(),
        Key: providerObjectKey(input.key, input.visibility),
      }));
      return true;
    } catch {
      return false;
    }
  }

  async getDownloadUrl(input: GetObjectInput & { expiresInSeconds?: number }) {
    const { s3, presigner, client } = await this.clientPromise;
    return presigner.getSignedUrl(
      client,
      new s3.GetObjectCommand({
        Bucket: this.bucket(),
        Key: providerObjectKey(input.key, input.visibility),
      }),
      { expiresIn: input.expiresInSeconds ?? 300 },
    );
  }
}

