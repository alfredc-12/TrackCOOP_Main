import {
  safeAuditValues,
  activityLabel,
} from "../audit-logs/activity.presentation";
import test from "node:test";
import assert from "node:assert/strict";
import { fixturePool, seedGallery } from "./gallery-placement.fixture";
import { createGalleryPlacementRepository } from "./gallery-placement.repository";
import {
  parse,
  placementSchema,
  proposePhotos,
} from "./gallery-placement.policy";
import { replaceAnnouncementImages } from "../communication/communication.repository";
const empty = (revision = "0") => ({
  expectedRevision: revision,
  slots: Array.from({ length: 7 }, (_, i) => ({
    position: i + 1,
    photo: null as null | {
      source: "gallery" | "announcement";
      photoId: string;
    },
  })),
});
test("placement validation requires seven unique positions and source-qualified image identities", () => {
  assert.throws(() => parse(placementSchema, { ...empty(), slots: [] }));
  const d = empty();
  d.slots[1].position = 1;
  assert.throws(() => parse(placementSchema, d));
  const duplicate = empty();
  duplicate.slots[0].photo = { source: "gallery", photoId: "1" };
  duplicate.slots[1].photo = { source: "gallery", photoId: "1" };
  assert.throws(() => parse(placementSchema, duplicate));
  duplicate.slots[1].photo = { source: "announcement", photoId: "1" };
  assert.doesNotThrow(() => parse(placementSchema, duplicate));
});
test("random proposals favor distinct groups, exclude repeated assets and handle fewer than seven", () => {
  const photos = [
    { source: "gallery", groupId: "1", imagePath: "/uploads/a.jpg" },
    { source: "gallery", groupId: "1", imagePath: "/uploads/b.jpg" },
    { source: "announcement", groupId: "1", imagePath: "/uploads/a.jpg" },
    { source: "announcement", groupId: "2", imagePath: "/uploads/c.jpg" },
  ];
  const p = proposePhotos(photos, () => 0);
  assert.equal(p.length, 3);
  assert.equal(new Set(p.map((x) => x.imagePath)).size, 3);
});
test(
  "Gallery placement real SQL: migration, publication, references and failure recovery",
  { skip: process.env.GALLERY_LOCAL_SQL_TEST !== "1" },
  async (t) => {
    const pool = await fixturePool();
    const repo = createGalleryPlacementRepository(pool);
    try {
      await seedGallery(pool);
      await t.test(
        "additive migration preserves legacy assignments and adds an empty seventh slot",
        async () => {
          const s = await repo.snapshot();
          assert.equal(s.slots.length, 7);
          assert.equal(s.slots[0].photo!.photoId, "1");
          assert.equal(s.slots[1].photo!.photoId, "2");
          assert.equal(s.slots[6].photo, null);
        },
      );
      await t.test(
        "library mixes original groups and resolves every attached photo",
        async () => {
          const lib = await repo.groups({
            source: "all",
            search: "",
            sort: "newest",
            page: 1,
            pageSize: 12,
          });
          assert.ok(lib.groups.some((g) => g.id === "gallery:1"));
          assert.ok(lib.groups.some((g) => g.id === "announcement:1"));
          assert.ok(
            !lib.groups.some(
              (g) => g.id === "announcement:2" || g.id === "announcement:6",
            ),
          );
          assert.equal(
            (await repo.groupPhotos("announcement", "1")).photos.length,
            4,
          );
          const props = await repo.proposal();
          assert.equal(props.photos.length, 7);
          assert.equal(new Set(props.photos.map((p) => p.id)).size, 7);
          assert.ok(props.photos.every((p) => p.eligible));
          assert.ok(
            props.photos.every((p) =>
              p.source === "gallery"
                ? p.groupId === "1"
                : ["1", "7"].includes(p.groupId),
            ),
          );
        },
      );
      await t.test(
        "randomizing changes no placements or audit records",
        async () => {
          const before = await repo.snapshot();
          await repo.proposal();
          assert.deepEqual(await repo.snapshot(), before);
          const [r] = await pool.query<
            import("mysql2/promise").RowDataPacket[]
          >("SELECT COUNT(*) n FROM audit_logs");
          assert.equal(r[0].n, 0);
        },
      );
      await t.test(
        "publishes exact mixed order and rejects stale sessions",
        async () => {
          const d = empty();
          d.slots[0].photo = { source: "announcement", photoId: "1" };
          d.slots[1].photo = { source: "gallery", photoId: "3" };
          const s = await repo.publish(parse(placementSchema, d), "1");
          assert.equal(s.revision, "1");
          assert.deepEqual(
            (await repo.publicPhotos()).map((p) => p.id),
            ["announcement:1", "gallery:3"],
          );
          await assert.rejects(() => repo.publish(d, "1"), {
            code: "GALLERY_PLACEMENT_CONFLICT",
          });
        },
      );
      await t.test(
        "ineligible selection and cross-source duplicate assets cannot publish",
        async () => {
          const d = empty("1");
          d.slots[0].photo = { source: "gallery", photoId: "7" };
          await assert.rejects(() => repo.publish(d, "1"), {
            code: "GALLERY_PHOTO_UNAVAILABLE",
          });
          d.slots[0].photo = { source: "gallery", photoId: "1" };
          d.slots[1].photo = { source: "announcement", photoId: "1" };
          await pool.query(
            "UPDATE announcement_images SET image_path='/images/Hero%20Page/Main%20Photo%201.jpg' WHERE announcement_image_id=1",
          );
          await assert.rejects(() => repo.publish(d, "1"), {
            code: "DUPLICATE_GALLERY_PHOTO",
          });
          await pool.query(
            "UPDATE announcement_images SET image_path='/images/announcements/Post%202.1.jpg' WHERE announcement_image_id=1",
          );
        },
      );
      await t.test(
        "audit failure rolls back all seven rows and revision",
        async () => {
          const before = await repo.snapshot();
          await pool.query(
            "CREATE TRIGGER reject_gallery_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture audit failure'",
          );
          const d = empty("1");
          await assert.rejects(() => repo.publish(d, "1"));
          await pool.query("DROP TRIGGER reject_gallery_audit");
          assert.deepEqual(await repo.snapshot(), before);
        },
      );
      await t.test(
        "reordering announcement photos retains their IDs and saved placement",
        async () => {
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            await replaceAnnouncementImages(
              conn,
              "1",
              [
                "/images/announcements/Post%202.2.jpg",
                "/images/announcements/Post%202.1.jpg",
              ],
              "Assembly",
            );
            await conn.commit();
          } finally {
            conn.release();
          }
          const s = await repo.snapshot();
          assert.equal(s.slots[0].photo!.photoId, "1");
          assert.equal(
            s.slots[0].photo!.imagePath,
            "/images/announcements/Post%202.1.jpg",
          );
        },
      );
      await t.test(
        "restricted or deleted selected images disappear without unrelated fallback",
        async () => {
          await pool.query(
            "UPDATE announcements SET audience_type='All Members' WHERE announcement_id=1",
          );
          assert.deepEqual(
            (await repo.publicPhotos()).map((p) => p.id),
            ["gallery:3"],
          );
          await pool.query(
            "DELETE FROM gallery_images WHERE gallery_image_id=3",
          );
          assert.deepEqual(await repo.publicPhotos(), []);
          const d = empty("1");
          const s = await repo.publish(d, "1");
          assert.equal(s.revision, "2");
          assert.deepEqual(await repo.publicPhotos(), []);
        },
      );
    } finally {
      await pool.end();
    }
  },
);

test("published placement audit values display only seven bounded source references", () => {
  const values = safeAuditValues({
    revision: "4",
    placements: Array.from({ length: 7 }, (_, i) => ({
      position: i + 1,
      source: "gallery",
      photoId: String(i + 1),
    })),
    secret: "never display",
    imageUrl: "https://example.invalid/private",
  });
  assert.equal(values?.["Photo 1"], "Gallery photo #1");
  assert.ok(!JSON.stringify(values).includes("private"));
  assert.equal(
    activityLabel("landing.gallery_placement.published"),
    "Published homepage photos",
  );
});
