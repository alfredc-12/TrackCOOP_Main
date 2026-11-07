import { createHash, randomUUID } from "node:crypto";
import {
  GetBucketPolicyStatusCommand,
  GetBucketVersioningCommand,
  GetObjectAclCommand,
  GetObjectCommand,
  GetPublicAccessBlockCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * A version-bound object read, not a financial-evidence verifier. The caller
 * must separately authorize the source/document and bind the expected identity
 * and digest to trusted server-side state. No public or legacy fallback exists.
 *
 * IAM, access points, account policy, encryption-key custody, and source writer
 * coordination require independent deployment review. This contract alone must
 * never produce a posting authorization or a financial fingerprint.
 */
type S3Reply = Record<string, unknown>;
type S3Sender = { send(command: unknown): Promise<S3Reply> };
export type S3EvidenceObject = {
  bucket: string;
  key: string;
  versionId: string;
  sha256: string;
  size: number;
  contentType: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const unavailable = () => new Error("Protected evidence object unavailable");

async function requirePrivateBucket(client: S3Sender,bucket: string) {
  const versioning = await client.send(new GetBucketVersioningCommand({Bucket:bucket}));
  if (versioning.Status !== "Enabled") throw unavailable();
  const publicBlock = await client.send(new GetPublicAccessBlockCommand({Bucket:bucket}));
  const block = publicBlock.PublicAccessBlockConfiguration as Record<string, unknown> | undefined;
  if (!block || !["BlockPublicAcls","IgnorePublicAcls","BlockPublicPolicy","RestrictPublicBuckets"].every(k => block[k] === true)) throw unavailable();
  const policy = await client.send(new GetBucketPolicyStatusCommand({Bucket:bucket}));
  if ((policy.PolicyStatus as Record<string, unknown> | undefined)?.IsPublic !== false) throw unavailable();
}

/** Creates a unique protected object version. If upload succeeds but any later
 * verification fails, the object is retained; callers need durable recovery. */
export async function writeVersionLockedS3Evidence(client:S3Sender,bucket:string,bytes:Buffer,contentType:string):Promise<S3EvidenceObject> {
  if(!bucket || !Buffer.isBuffer(bytes) || bytes.length<1 || bytes.length>MAX_BYTES || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(contentType)) throw unavailable();
  try {
    await requirePrivateBucket(client,bucket);
    const key=`protected/evidence/${randomUUID()}/${randomUUID()}`;
    const written=await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:contentType,IfNoneMatch:"*"}));
    if(typeof written.VersionId!=="string" || !written.VersionId || written.VersionId==="null") throw unavailable();
    const identity={bucket,key,versionId:written.VersionId,sha256:createHash("sha256").update(bytes).digest("hex"),size:bytes.length,contentType};
    await readVersionLockedS3Evidence(client,identity);
    return identity;
  } catch {throw unavailable();}
}

async function bytesFrom(body: unknown, limit: number): Promise<Buffer> {
  if (!(body instanceof Uint8Array) && (!body || typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== "function")) throw unavailable();
  const chunks: Buffer[] = [];
  let size = 0;
  const stream = body instanceof Uint8Array ? [body] : body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > limit) throw unavailable();
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function readVersionLockedS3Evidence(client: S3Sender, identity: S3EvidenceObject): Promise<Buffer> {
  const {bucket,key,versionId,sha256,size,contentType} = identity;
  if (!bucket || !/^protected\/evidence\/[a-f0-9-]+\/[a-f0-9-]+$/i.test(key) || !versionId || versionId === "null" || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(contentType)) throw unavailable();
  try {
    await requirePrivateBucket(client,bucket);
    const acl = await client.send(new GetObjectAclCommand({Bucket:bucket,Key:key,VersionId:versionId}));
    const owner=(acl.Owner as Record<string, unknown> | undefined)?.ID;
    const grants=acl.Grants as Array<Record<string, unknown>> | undefined;
    if (typeof owner !== "string" || !owner || !Array.isArray(grants) || grants.length !== 1 || grants[0].Permission !== "FULL_CONTROL") throw unavailable();
    const grantee=grants[0].Grantee as Record<string, unknown> | undefined;
    if (grantee?.Type !== "CanonicalUser" || grantee.ID !== owner) throw unavailable();
    const head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:key,VersionId:versionId}));
    if (head.VersionId !== versionId || head.ContentLength !== size || head.ContentType !== contentType || head.ObjectLockMode !== "COMPLIANCE" || !(head.ObjectLockRetainUntilDate instanceof Date) || !Number.isFinite(head.ObjectLockRetainUntilDate.getTime()) || head.ObjectLockRetainUntilDate.getTime() <= Date.now()) throw unavailable();
    const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:key,VersionId:versionId}));
    if (object.VersionId !== versionId || object.ContentLength !== size || object.ContentType !== contentType) throw unavailable();
    const bytes=await bytesFrom(object.Body,size);
    if (bytes.length !== size || createHash("sha256").update(bytes).digest("hex") !== sha256 || (head.ObjectLockRetainUntilDate as Date).getTime() <= Date.now()) throw unavailable();
    return bytes;
  } catch {
    // Avoid exposing bucket names, object keys, provider errors or permissions.
    throw unavailable();
  }
}
