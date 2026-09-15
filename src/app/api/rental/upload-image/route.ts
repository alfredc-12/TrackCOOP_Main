import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  MAX_RENTAL_ASSET_PHOTOS,
  validateRentalAssetPhoto,
} from "@/app/rental/_lib/rentalPhotos";

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireApiUser(["chairman"]);
    if (response) return response;

    const formData = await request.formData();
    const files = [
      ...formData.getAll("images"),
      ...formData.getAll("image"),
    ].filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json(
        { error: "Upload at least one photo." },
        { status: 400 },
      );
    }
    if (files.length > MAX_RENTAL_ASSET_PHOTOS) {
      return NextResponse.json(
        { error: "Upload up to 5 photos only." },
        { status: 400 },
      );
    }

    const publicDir = join(process.cwd(), "public", "uploads", "rentals");
    await mkdir(publicDir, { recursive: true });

    const urls: string[] = [];
    for (const file of files) {
      const validationError = validateRentalAssetPhoto(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const extension = extensionByType[file.type] ?? "jpg";
      const filename = `${randomUUID()}.${extension}`;
      const filePath = join(publicDir, filename);

      await writeFile(filePath, buffer);
      urls.push(`/uploads/rentals/${filename}`);
    }

    return NextResponse.json({ url: urls[0], urls });
  } catch (error) {
    console.error(`POST /api/rental/upload-image error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
