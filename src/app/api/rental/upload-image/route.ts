import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to public directory
    const publicDir = join(process.cwd(), "public", "uploads", "rentals");
    await mkdir(publicDir, { recursive: true });

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(publicDir, filename);

    await writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/rentals/${filename}` });
  } catch (error) {
    console.error(`POST /api/rental/upload-image error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
