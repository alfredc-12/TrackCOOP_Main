import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalStorageProvider } from "./local-storage-provider";

test("LocalStorageProvider saves, retrieves, and deletes files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "trackcoop-storage-"));
  try {
    const storage = new LocalStorageProvider(root);
    const stored = await storage.put({
      key: "documents/example.txt",
      visibility: "protected",
      body: Buffer.from("hello"),
      contentType: "text/plain",
    });

    assert.equal(stored.path, "public/uploads/documents/example.txt");
    assert.equal((await storage.get({ key: stored.path, visibility: "protected" })).toString(), "hello");
    assert.equal(await storage.exists?.({ key: stored.path, visibility: "protected" }), true);
    await storage.delete({ key: stored.path, visibility: "protected" });
    assert.equal(await storage.exists?.({ key: stored.path, visibility: "protected" }), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LocalStorageProvider blocks protected path traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "trackcoop-storage-"));
  try {
    const storage = new LocalStorageProvider(root);
    await assert.rejects(
      () => storage.put({
        key: "../escape.txt",
        visibility: "protected",
        body: Buffer.from("bad"),
      }),
      /Storage key must stay inside configured storage|Storage path escaped/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("exclusive protected writes cannot overwrite an existing object", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "trackcoop-storage-exclusive-"));
  try {
    const storage = new LocalStorageProvider(root);
    const input = {key:"receipts/unique.pdf",visibility:"protected" as const,ifAbsent:true};
    const attempts = await Promise.allSettled([
      storage.put({...input,body:Buffer.from("first")}),
      storage.put({...input,body:Buffer.from("second")}),
    ]);
    assert.equal(attempts.filter(a=>a.status==="fulfilled").length,1);
    assert.equal(attempts.filter(a=>a.status==="rejected").length,1);
    const saved=await storage.get({key:input.key,visibility:"protected"});
    assert.ok(["first","second"].includes(saved.toString()));
    await assert.rejects(storage.put({...input,body:Buffer.from("overwrite")}));
    assert.deepEqual(await storage.get({key:input.key,visibility:"protected"}),saved);
  } finally {await rm(root,{recursive:true,force:true});}
});
