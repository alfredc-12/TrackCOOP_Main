import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";
import { createPatronageCapitalRouter } from "./patronage-capital.routes";
import type { PatronageCapitalRepository } from "./patronage-capital.repository";

function app() {
  const calls: Array<{ method: string; actor: string; input?: unknown }> = [];
  const auth = { authenticate: async (role: AuthUser["role"] | undefined) => { if (!role) throw new AppError("Authentication required.", 401, "UNAUTHENTICATED"); return { user: { id: role, role }, sessionId: "1", tokenHash: "test" }; } } as unknown as AuthService;
  const repo = {
    overview: async () => ({ currentCapital: 2000, availableCapacity: 13000, refunds: [], transfers: [] }),
    list: async () => [],
    request: async (input, actor) => { calls.push({ method: "request", actor: actor.user.id, input }); return { id: "1", status: "Pending" } as never; },
    decide: async (_id, input, actor) => { calls.push({ method: "decide", actor: actor.user.id, input }); return { id: "1", status: "Approved" } as never; },
  } satisfies PatronageCapitalRepository;
  const server = express(); server.use(express.json()); server.use(cookieParser());
  server.use("/api", createPatronageCapitalRouter(auth, repo)); server.use(errorHandler);
  return { server, calls };
}

const body = { allocationId: "10", amount: 100, requestKey: "4c106f59-1548-4c75-8eb3-351a33817fc0" };

test("member requests use the authenticated owner and cannot select a different member", async () => {
  const { server, calls } = app();
  const result = await request(server).post("/api/members/me/patronage-capital").set("Cookie", "trackcoop_session=member").send({ ...body, memberId: "someone-else" });
  assert.equal(result.status, 201); assert.equal(calls[0].actor, "member"); assert.deepEqual(calls[0].input, body);
});

test("only Bookkeepers can approve or decline a refund transfer", async () => {
  for (const role of ["member", "chairman", "bookkeeper"]) {
    const { server, calls } = app();
    const result = await request(server).post("/api/patronage/capital-transfers/1/decision").set("Cookie", `trackcoop_session=${role}`).send({ decision: "Approve" });
    assert.equal(result.status, role === "bookkeeper" ? 200 : 403);
    assert.equal(calls.length, role === "bookkeeper" ? 1 : 0);
  }
});

test("staff cannot use member transfer requests, and members cannot read the staff queue", async () => {
  const { server } = app();
  assert.equal((await request(server).post("/api/members/me/patronage-capital").set("Cookie", "trackcoop_session=bookkeeper").send(body)).status, 403);
  assert.equal((await request(server).get("/api/patronage/capital-transfers").set("Cookie", "trackcoop_session=member")).status, 403);
  assert.equal((await request(server).get("/api/members/me/patronage-capital")).status, 401);
});

test("invalid amounts and request keys are rejected before any transfer is created", async () => {
  const { server, calls } = app();
  for (const amount of [0, -1, 1.001, "100"]) {
    const result = await request(server).post("/api/members/me/patronage-capital").set("Cookie", "trackcoop_session=member").send({ ...body, amount });
    assert.equal(result.status, 400);
  }
  assert.equal((await request(server).post("/api/members/me/patronage-capital").set("Cookie", "trackcoop_session=member").send({ ...body, requestKey: "bad-key" })).status, 400);
  assert.equal(calls.length, 0);
});
