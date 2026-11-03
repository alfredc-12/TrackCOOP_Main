import assert from "node:assert/strict";
import test from "node:test";
import { listShareCapital } from "./finance-api";

test("share capital requests the selected server page and retains its total", async () => {
  const original = globalThis.fetch;
  let url = "";
  globalThis.fetch = (async input => {
    url = String(input);
    return new Response(JSON.stringify({ success: true, data: [{ id: "101" }], meta: { total: 611, page: 3, pageSize: 20 } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await listShareCapital("Maria", "Validated", 3, 20);
    const params = new URL(url).searchParams;
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("pageSize"), "20");
    assert.equal(params.get("search"), "Maria");
    assert.equal(params.get("paymentStatus"), "Validated");
    assert.equal(result.meta.total, 611);
    assert.equal(result.items[0].id, "101");
  } finally { globalThis.fetch = original; }
});
