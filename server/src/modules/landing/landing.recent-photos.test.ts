import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { loadRecentLandingPhotos } from "./landing.recent-photos";

function database(rows: Record<string, unknown>[]) {
  const statements: string[] = [];
  return {
    statements,
    pool: {
      async execute(sql: string) {
        statements.push(sql);
        return [rows, []];
      },
    } as unknown as Pool,
  };
}

test("recent photo query merges sources before limiting and orders by publication rather than edits or placements", async () => {
  const db = database([]);
  await loadRecentLandingPhotos(db.pool);
  const sql = db.statements[0];
  assert.match(sql, /UNION ALL/);
  assert.match(sql, /COALESCE\(g\.published_at, g\.created_at\)/);
  assert.match(sql, /COALESCE\(a\.posted_at, a\.publish_at, a\.created_at\)/);
  assert.match(sql, /ORDER BY recent\.publishedAt DESC, recent\.source ASC, recent\.recordId DESC\s+LIMIT 7/);
  assert.doesNotMatch(sql, /updated_at|gallery_landing_slots|display_order/);
});

test("recent photo query protects public access and excludes expired, future, and imageless posts", async () => {
  const db = database([]);
  await loadRecentLandingPhotos(db.pool);
  const sql = db.statements[0];
  assert.match(sql, /g\.public_visibility = 1 AND g\.gallery_status = 'Published'/);
  assert.match(sql, /gi\.public_visibility = 1/);
  assert.match(sql, /a\.audience_type = 'Public' AND a\.announcement_status = 'Published'/);
  assert.match(sql, /a\.expires_at IS NULL OR a\.expires_at >= NOW\(\)/);
  assert.match(sql, /a\.publish_at IS NULL OR a\.publish_at <= NOW\(\)/);
  assert.match(sql, /recent\.publishedAt <= NOW\(\)/);
  assert.match(sql, /NULLIF\(TRIM\(recent\.imagePath\), ''\) IS NOT NULL/);
});

test("recent photo query chooses the first visible ordered photo, not the featured or cover image", async () => {
  const db = database([]);
  await loadRecentLandingPhotos(db.pool);
  const sql = db.statements[0];
  assert.match(sql, /ORDER BY gi\.sort_order ASC, gi\.gallery_image_id ASC LIMIT 1/);
  assert.match(sql, /ORDER BY first_image\.sort_order ASC, first_image\.announcement_image_id ASC LIMIT 1/);
  assert.match(sql, /CASE WHEN ai\.announcement_image_id IS NOT NULL THEN ai\.image_path\s+ELSE a\.featured_image_path END/);
  assert.doesNotMatch(sql, /is_cover|is_featured/);
});

test("recent photos preserve mixed source order and qualify colliding IDs without duplicating post photos", async () => {
  const sources = ["gallery", "announcement", "announcement", "gallery", "gallery", "announcement", "gallery"];
  const db = database(sources.map((source, index) => ({
    recordId: String(Math.floor(index / 2) + 1), source, title: "Shared title",
    caption: index === 0 ? '<p>Farm &amp; fishery</p><script>hidden()</script><p>Training &#38; support</p>' : "",
    imagePath: ` /uploads/${source}/${index}.jpg `,
    publishedAt: new Date(Date.UTC(2026, 10, 7 - index)),
  })));
  const photos = await loadRecentLandingPhotos(db.pool);
  assert.equal(photos.length, 7);
  assert.deepEqual(photos.map((photo) => photo.source), sources);
  assert.equal(new Set(photos.map((photo) => photo.id)).size, 7);
  assert.equal(photos[0].id, "gallery:1");
  assert.equal(photos[1].id, "announcement:1");
  assert.equal(photos[0].caption, "Farm & fishery Training & support");
  assert.equal(photos[0].imagePath, "/uploads/gallery/0.jpg");
  assert.equal(photos[0].publishedAt, "2026-11-07T00:00:00.000Z");
});

test("recent photos return no invented images for an empty database", async () => {
  const db = database([]);
  assert.deepEqual(await loadRecentLandingPhotos(db.pool), []);
});
