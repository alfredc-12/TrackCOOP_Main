import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Announcement } from "../src/features/announcements/types";

const AUTHOR_NAME = "Don Jonson";
const AUTHOR_URL = "https://www.facebook.com/tdrjonson";
const ROOT = process.cwd();
const DATA_FILE = path.join(
  ROOT,
  "src",
  "features",
  "announcements",
  "data",
  "announcements.json",
);
const IMAGE_DIR = path.join(ROOT, "public", "images", "announcements");

const POST_URLS = [
  "https://www.facebook.com/tdrjonson/posts/pfbid02D36puPoUjtzG2imXFW8STczkr69b35jJEu51X2r8Yw7yUytPEnGnmzYPGWAKdp4Pl?rdid=EAIflv1sJTPeY07T#",
  "https://www.facebook.com/tdrjonson/posts/pfbid0gdMhB5C9jRQoK3XsgB5HK2jhGAjGsWDV7iA36aggdrLVEffJKUZnTFbb2yNk14mpl",
  "https://www.facebook.com/tdrjonson/posts/pfbid02Ytq8XVbbVA5FKWpDsQRjmGivLNCR9fk2PaY9fmdXrarAReidr8c5jXaadv7boUGLl",
  "https://www.facebook.com/tdrjonson/posts/pfbid02L2pJb517o43LfBDHdL457pReesDYp9vCjkCxB5bjSsL3ZxzndoAMQHT9y4G9Zj47l",
  "https://www.facebook.com/tdrjonson/posts/pfbid029CRRN9u1o6MGRbJYbxCHMR4wkmMqUKkS1rR7LypnzXt4C7fPQYyfmLpZR4bNLmrcl",
] as const;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getMeta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(propertyPattern) ?? html.match(contentFirstPattern);

  return match?.[1] ? decodeHtml(match[1].trim()) : undefined;
}

function getImageUrls(html: string) {
  const urls = new Set<string>();
  const metaImage = getMeta(html, "og:image");

  if (metaImage) urls.add(metaImage);

  for (const match of html.matchAll(/https:\\\/\\\/[^"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>]+)?/gi)) {
    urls.add(match[0].replace(/\\\//g, "/"));
  }

  return [...urls].filter((url) => !url.includes("emoji.php"));
}

function generateTitle(caption: string) {
  const firstSentence = caption.split(/[.!?]\s/)[0]?.trim();
  const words = (firstSentence || caption).split(/\s+/).slice(0, 12);

  return words.join(" ").replace(/[.,;:!?]+$/, "");
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function imageExtension(contentType: string | null, fallbackUrl: string) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  const ext = fallbackUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1]?.toLowerCase();

  return ext === "jpeg" ? "jpg" : ext || "jpg";
}

async function readExistingAnnouncements() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Announcement[];
  } catch {
    return [];
  }
}

async function downloadImage(url: string, announcementId: string, index: number) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}) for ${url}`);
  }

  const extension = imageExtension(response.headers.get("content-type"), url);
  const filename = `${announcementId}-${index + 1}.${extension}`;
  const diskPath = path.join(IMAGE_DIR, filename);
  const publicPath = `/images/announcements/${filename}`;
  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(diskPath, buffer);
  return publicPath;
}

async function importPost(url: string, id: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; TrackCOOPAnnouncementImporter/1.0)",
    },
  });

  if (!response.ok) {
    console.warn(`Skipped ${url}: unavailable (${response.status})`);
    return undefined;
  }

  const html = await response.text();
  const caption = getMeta(html, "og:description") || getMeta(html, "description");
  const authorLooksValid = html.includes(AUTHOR_NAME) || html.includes("tdrjonson");
  const isVideo = /\/videos\/|\/reel\/|live video|watch\?/i.test(html);
  const imageUrls = getImageUrls(html);

  if (!authorLooksValid) {
    console.warn(`Skipped ${url}: author could not be verified as ${AUTHOR_NAME}`);
    return undefined;
  }

  if (isVideo) {
    console.warn(`Skipped ${url}: video/reel/live content`);
    return undefined;
  }

  if (!caption) {
    console.warn(`Skipped ${url}: no caption text found`);
    return undefined;
  }

  if (!imageUrls.length) {
    console.warn(`Skipped ${url}: no photos found`);
    return undefined;
  }

  const images: string[] = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      images.push(await downloadImage(imageUrl, id, index));
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
    }
  }

  if (!images.length) {
    console.warn(`Skipped ${url}: photos could not be downloaded`);
    return undefined;
  }

  return {
    id,
    title: generateTitle(caption),
    content: caption,
    images,
    sourceUrl: url,
    originalAuthorName: AUTHOR_NAME,
    originalAuthorUrl: AUTHOR_URL,
    postedAt: normalizeDate(getMeta(html, "article:published_time")),
    importedAt: new Date().toISOString().slice(0, 10),
    type: "facebook_fixed_post",
  } satisfies Announcement;
}

async function main() {
  await mkdir(IMAGE_DIR, { recursive: true });

  const existing = await readExistingAnnouncements();
  const existingByUrl = new Map(existing.map((item) => [item.sourceUrl, item]));
  const imported: Announcement[] = [];
  const replacedUrls = new Set<string>();

  for (const [index, url] of POST_URLS.entries()) {
    const existingAnnouncement = existingByUrl.get(url);
    const onlyHasPlaceholder =
      existingAnnouncement?.images.every((image) =>
        image.includes("announcement-placeholder.svg"),
      ) ?? false;

    if (existingAnnouncement && !onlyHasPlaceholder) {
      console.log(`Skipped ${url}: duplicate sourceUrl`);
      continue;
    }

    const announcement = await importPost(url, `announcement-${existing.length + imported.length + index + 1}`);

    if (announcement) {
      imported.push({
        ...announcement,
        id: existingAnnouncement?.id ?? announcement.id,
      });
      replacedUrls.add(url);
    }
  }

  const allAnnouncements = [
    ...existing.filter((item) => !replacedUrls.has(item.sourceUrl)),
    ...imported,
  ].sort((a, b) => {
    const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return bTime - aTime;
  });

  await writeFile(DATA_FILE, `${JSON.stringify(allAnnouncements, null, 2)}\n`);
  console.log(`Imported or replaced ${imported.length} announcement(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
