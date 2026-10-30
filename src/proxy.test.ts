import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

test("member detail links resolve their own pages while the member dashboard keeps its custom layout", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true, data: { role: "member" } }), { headers: { "content-type": "application/json" } }));
  for (const [path, expected] of [
    ["/portal/member/patronage", "/portal/member/patronage"],
    ["/portal/member/share-capital", "/portal/member/share-capital"],
    ["/portal/member/dashboard", "/member_dashboard"],
  ]) {
    const request = new NextRequest(`https://trackcoop.test${path}`, { headers: { cookie: `${process.env.SESSION_COOKIE_NAME ?? "trackcoop_session"}=test-session` } });
    const response = await proxy(request);
    assert.equal(new URL(response.headers.get("x-middleware-rewrite")!).pathname, expected);
  }
});

test("anonymous users cannot access member details through the routing exception", async () => {
  const response = await proxy(new NextRequest("https://trackcoop.test/portal/member/patronage"));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")!).pathname, "/login");
});
