import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Build this public geography asset from the supplied file; no member data is served here.
export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  // Retain the existing URL while serving the complete Batangas geography asset.
  const boundaries = await readFile(join(process.cwd(), "src/lib/Nasugbu.geojson"), "utf8");
  return new Response(boundaries, {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
