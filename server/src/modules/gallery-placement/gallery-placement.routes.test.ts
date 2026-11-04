import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createGalleryPlacementRouter } from "./gallery-placement.routes";
import type { GalleryPlacementRepository } from "./gallery-placement.repository";
import type { AuthService } from "../auth/auth.service";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
const empty = {
  revision: "0",
  slots: Array.from({ length: 7 }, (_, i) => ({
    position: i + 1,
    photo: null,
    unavailable: false,
  })),
};
function appFor(role: string | null = "chairman") {
  const calls: string[] = [];
  const auth = {
    authenticate: async () => {
      if (!role) throw new AppError("Login required", 401);
      return {
        user: { id: "1", role, displayName: "Fixture Chair" },
        sessionId: "fixture",
        tokenHash: "fixture",
      };
    },
  } as unknown as AuthService;
  const repo = {
    snapshot: async () => {
      calls.push("read");
      return empty;
    },
    groups: async () => ({ groups: [], total: 0, page: 1, pageSize: 12 }),
    groupPhotos: async () => ({ photos: [], page: 1, hasMore: false }),
    proposal: async () => {
      calls.push("proposal");
      return { photos: [], availablePositions: 0 };
    },
    publish: async () => {
      calls.push("publish");
      return empty;
    },
  } as unknown as GalleryPlacementRepository;
  const app = express()
    .use(express.json())
    .use(cookieParser())
    .use("/api", createGalleryPlacementRouter(auth, repo))
    .use(errorHandler);
  return { app, calls };
}
test("library and publication endpoints are Chairman-only", async () => {
  for (const role of [null, "member", "bookkeeper"]) {
    const { app, calls } = appFor(role);
    for (const [method, path] of [
      ["get", "gallery-library"],
      ["get", "gallery-placement"],
      ["post", "gallery-placement/proposal"],
      ["put", "gallery-placement"],
    ] as const) {
      const response = await request(app)
        [method](`/api/landing/${path}`)
        .set("Cookie", "trackcoop_session=fixture")
        .send({});
      assert.equal(response.status, role ? 403 : 401);
    }
    assert.deepEqual(calls, []);
  }
});
test("unknown fields, duplicate photos and incomplete positions are rejected before persistence", async () => {
  const { app, calls } = appFor();
  for (const body of [
    { expectedRevision: "0", slots: [] },
    {
      expectedRevision: "0",
      slots: empty.slots.map(({ position }) => ({
        position,
        photo: { source: "gallery", photoId: "1" },
      })),
    },
    {
      expectedRevision: "0",
      slots: empty.slots.map(({ position }) => ({ position, photo: null })),
      imageUrl: "https://untrusted.invalid/image.jpg",
    },
  ]) {
    const response = await request(app)
      .put("/api/landing/gallery-placement")
      .set("Cookie", "trackcoop_session=fixture")
      .send(body);
    assert.equal(response.status, 422);
  }
  assert.deepEqual(calls, []);
});
test("proposal does not persist and a valid seven-position publish uses the guarded repository", async () => {
  const { app, calls } = appFor();
  const proposal = await request(app)
    .post("/api/landing/gallery-placement/proposal")
    .set("Cookie", "trackcoop_session=fixture")
    .send({ excluded: ["gallery:1"] });
  assert.equal(proposal.status, 200);
  assert.deepEqual(calls, ["proposal"]);
  const save = await request(app)
    .put("/api/landing/gallery-placement")
    .set("Cookie", "trackcoop_session=fixture")
    .send({
      expectedRevision: "0",
      slots: empty.slots.map(({ position }) => ({ position, photo: null })),
    });
  assert.equal(save.status, 200);
  assert.deepEqual(calls, ["proposal", "publish"]);
});
