import assert from "node:assert/strict";
import { test, mock } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { env } from "../../config/env";
import { closePool, getPool } from "../../db/pool";
import type { AuthService } from "../auth/auth.service";
import { rentalDatabase } from "./rental.repository";
import { createRentalRouter } from "./rental.routes";

for (const member of [true, false]) {
  test(`public catalog submission ${member ? "links the session member" : "keeps guest bookings unlinked"}`, async () => {
    const db = mock.method(getPool(), "execute", async () => [[{ memberId: "12" }], []]);
    const submit = mock.method(rentalDatabase, "submitRentalInquiry", async () => ({ requester: { email: "" } }));
    try {
      const auth = { authenticate: async () => ({ user: { id: "7", displayName: "Member", role: "member" } }) } as unknown as AuthService;
      const app = express();
      app.use(cookieParser());
      app.use("/api", createRentalRouter(auth));
      const req = request(app).post("/api/rental/inquiries/public");
      if (member) req.set("Cookie", `${env.SESSION_COOKIE_NAME}=test-session`);
      const response = await req.field("draft", JSON.stringify({ memberId: 999, requesterType: "Public or Non-member" }))
        .attach("validId", Buffer.from("89504e470d0a1a0a0000000d", "hex"), { filename: "id.png", contentType: "image/png" });
      assert.equal(response.status,201);
      const args = submit.mock.calls[0].arguments;
      assert.equal(args[2],member);
      assert.equal(args[3]?.memberId,member ? 12 : undefined);
      assert.equal(args[3]?.userId,member ? 7 : undefined);
      assert.equal(db.mock.callCount(),member ? 1 : 0);
    } finally {
      db.mock.restore();
      submit.mock.restore();
      await closePool();
    }
  });
}
