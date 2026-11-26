import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { readVersionLockedS3Evidence, writeVersionLockedS3Evidence } from "./evidence-s3-version";

test("version-locked evidence uses versioned S3 requests against an isolated loopback fixture",async()=>{
 const seen:Array<{method:string;url:string;ifNoneMatch:string|undefined}>=[];
 const payload=Buffer.from("synthetic S3 evidence");
 const xml=(body:string)=>`<?xml version="1.0" encoding="UTF-8"?>${body}`;
 const server=createServer((req,res)=>{
  const url=new URL(req.url ?? "/","http://127.0.0.1");
  seen.push({method:req.method ?? "",url:url.pathname+url.search,ifNoneMatch:req.headers["if-none-match"]});
  res.setHeader("x-amz-version-id","fixture-version");
  if(req.method==="PUT") {res.statusCode=200;res.end();return;}
  if(url.searchParams.has("versioning")){res.end(xml("<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>"));return;}
  if(url.searchParams.has("publicAccessBlock")){res.end(xml("<PublicAccessBlockConfiguration><BlockPublicAcls>true</BlockPublicAcls><IgnorePublicAcls>true</IgnorePublicAcls><BlockPublicPolicy>true</BlockPublicPolicy><RestrictPublicBuckets>true</RestrictPublicBuckets></PublicAccessBlockConfiguration>"));return;}
  if(url.searchParams.has("policyStatus")){res.end(xml("<PolicyStatus><IsPublic>false</IsPublic></PolicyStatus>"));return;}
  if(url.searchParams.has("acl")){res.end(xml("<AccessControlPolicy><Owner><ID>fixture-owner</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:type=\"CanonicalUser\"><ID>fixture-owner</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>"));return;}
  res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Length",String(payload.length));
  if(req.method==="HEAD"){res.setHeader("x-amz-object-lock-mode","COMPLIANCE");res.setHeader("x-amz-object-lock-retain-until-date",new Date(Date.now()+60000).toISOString());res.end();return;}
  res.end(payload);
 });
 await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 const port=(server.address() as AddressInfo).port;
 const client=new S3Client({region:"fixture",endpoint:`http://127.0.0.1:${port}`,forcePathStyle:true,credentials:{accessKeyId:"fixture",secretAccessKey:"fixture"},maxAttempts:1});
 const sender={send:async (command:unknown)=>await client.send(command as GetObjectCommand) as unknown as Record<string,unknown>};
 try {
  const identity=await writeVersionLockedS3Evidence(sender,"fixture",payload,"application/pdf");
  assert.deepEqual(await readVersionLockedS3Evidence(sender,identity),payload);
  const put=seen.find(r=>r.method==="PUT");assert.equal(put?.ifNoneMatch,"*");
  for(const request of seen.filter(r=>r.method==="HEAD" || (r.method==="GET" && r.url.includes("versionId="))))assert.match(request.url,/versionId=fixture-version/);
 } finally {client.destroy();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
