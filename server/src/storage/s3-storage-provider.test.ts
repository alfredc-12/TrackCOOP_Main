import assert from "node:assert/strict";
import test from "node:test";
import { s3PutRequest } from "./s3-storage-provider";

test("protected exclusive S3 write requests conditional creation without a public ACL", () => {
  const request=s3PutRequest("synthetic-bucket",{key:"receipts/a.pdf",visibility:"protected",body:Buffer.from("fixture"),ifAbsent:true});
  assert.equal(request.IfNoneMatch,"*");
  assert.match(request.Key,/^protected\//);
  assert.equal("ACL" in request,false);
  assert.equal("IfNoneMatch" in s3PutRequest("synthetic-bucket",{key:"a.pdf",visibility:"protected",body:Buffer.from("fixture")}),false);
});
