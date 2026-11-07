import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readVersionLockedS3Evidence, writeVersionLockedS3Evidence, type S3EvidenceObject } from "./evidence-s3-version";

const payload=Buffer.from("synthetic private evidence");
const identity:S3EvidenceObject={bucket:"fixture",key:"protected/evidence/a1/b2",versionId:"v1",sha256:createHash("sha256").update(payload).digest("hex"),size:payload.length,contentType:"application/pdf"};
const block={BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true};
function provider(overrides:Record<string,unknown>={}) {
  const seen:Array<{name:string;input:Record<string,unknown>}> = [];
  const responses:Record<string,unknown>={
    GetBucketVersioningCommand:{Status:"Enabled"},
    GetPublicAccessBlockCommand:{PublicAccessBlockConfiguration:block},
    GetBucketPolicyStatusCommand:{PolicyStatus:{IsPublic:false}},
    GetObjectAclCommand:{Owner:{ID:"owner"},Grants:[{Permission:"FULL_CONTROL",Grantee:{Type:"CanonicalUser",ID:"owner"}}]},
    HeadObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"application/pdf",ObjectLockMode:"COMPLIANCE",ObjectLockRetainUntilDate:new Date(Date.now()+60000)},
    GetObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"application/pdf",Body:payload},
    PutObjectCommand:{VersionId:"v1"},
    ...overrides,
  };
  return {seen,async send(command:unknown){const c=command as {constructor:{name:string};input:Record<string,unknown>};seen.push({name:c.constructor.name,input:c.input});const response=responses[c.constructor.name];if(response instanceof Error)throw response;return response as Record<string,unknown>;}};
}

test("version-bound read checks private bucket, locked object and exact bytes",async()=>{
 const p=provider();assert.deepEqual(await readVersionLockedS3Evidence(p,identity),payload);
 for(const c of p.seen.filter(c=>["GetObjectAclCommand","HeadObjectCommand","GetObjectCommand"].includes(c.name))) assert.equal(c.input.VersionId,"v1");
});

test("version-locked write generates a protected unique key and verifies its exact version",async()=>{
 const p=provider();const result=await writeVersionLockedS3Evidence(p,"fixture",payload,"application/pdf");
 const put=p.seen.find(c=>c.name==="PutObjectCommand");assert.ok(put);assert.equal(put.input.IfNoneMatch,"*");
 assert.equal(put.input.Key,result.key);assert.equal(result.versionId,"v1");assert.equal(result.sha256,identity.sha256);
 assert.ok(p.seen.filter(c=>c.name==="GetObjectCommand").every(c=>c.input.VersionId===result.versionId));
});

test("failed privacy checks prevent upload and failed post-upload checks never claim success",async()=>{
 const privateFailure=provider({GetBucketPolicyStatusCommand:{PolicyStatus:{IsPublic:true}}});
 await assert.rejects(writeVersionLockedS3Evidence(privateFailure,"fixture",payload,"application/pdf"));
 assert.equal(privateFailure.seen.some(c=>c.name==="PutObjectCommand"),false);
 const lockFailure=provider({HeadObjectCommand:{VersionId:"v1",ContentLength:payload.length}});
 await assert.rejects(writeVersionLockedS3Evidence(lockFailure,"fixture",payload,"application/pdf"));
 assert.equal(lockFailure.seen.some(c=>c.name==="PutObjectCommand"),true);
 assert.equal(lockFailure.seen.some(c=>/Delete/.test(c.name)),false);
});

test("unproven privacy, retention, version or content fails closed",async()=>{
 for(const change of [
  {GetBucketVersioningCommand:{Status:"Suspended"}},
  {GetPublicAccessBlockCommand:{PublicAccessBlockConfiguration:{...block,BlockPublicPolicy:false}}},
  {GetBucketPolicyStatusCommand:{PolicyStatus:{IsPublic:true}}},
  {GetObjectAclCommand:{Owner:{ID:"owner"},Grants:[{Permission:"READ",Grantee:{Type:"Group",URI:"public"}}]}},
  {HeadObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"application/pdf",ObjectLockMode:"GOVERNANCE",ObjectLockRetainUntilDate:new Date(Date.now()+60000)}},
  {HeadObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"application/pdf",ObjectLockMode:"COMPLIANCE",ObjectLockRetainUntilDate:new Date(0)}},
  {GetObjectCommand:{VersionId:"v2",ContentLength:payload.length,ContentType:"application/pdf",Body:payload}},
  {GetObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"application/pdf",Body:Buffer.alloc(payload.length)}},
  {GetObjectCommand:{VersionId:"v1",ContentLength:payload.length,ContentType:"text/plain",Body:payload}},
  {GetObjectCommand:new Error("sensitive provider detail")},
 ]) await assert.rejects(readVersionLockedS3Evidence(provider(change),identity),{message:"Protected evidence object unavailable"});
 for(const invalid of [{key:"protected/evidence/../secret"},{versionId:"null"},{sha256:"bad"},{size:0}]) await assert.rejects(readVersionLockedS3Evidence(provider(),{...identity,...invalid}));
});
