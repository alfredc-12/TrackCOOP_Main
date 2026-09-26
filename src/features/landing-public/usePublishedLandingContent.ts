"use client";

import { useEffect, useState } from "react";
import { env } from "@/config/env";
import { resolveUploadUrl } from "@/lib/upload-url";

export type PublishedLandingRow = Record<string, unknown> & {
  id: string;
};

type PublishedLandingPayload = {
  partners: PublishedLandingRow[];
  gallery: PublishedLandingRow[];
};

const emptyPayload: PublishedLandingPayload = {
  partners: [],
  gallery: [],
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function resolveMediaPath(path: string) {
  return resolveUploadUrl(path);
}

function isPdfPath(path: string) {
  return path.toLowerCase().split("?")[0].endsWith(".pdf");
}

export function usePublishedLandingContent() {
  const [content, setContent] = useState<PublishedLandingPayload>(emptyPayload);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`${env.apiUrl}/api/public/landing`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: PublishedLandingPayload;
        };
        if (response.ok && payload.success && payload.data) {
          setContent(payload.data);
        }
      } catch {
        setContent(emptyPayload);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return content;
}

export function mapPublishedGallery(rows: PublishedLandingRow[], areaClasses: string[]) {
  return rows.slice(0, areaClasses.length).map((row, index) => ({
    title: asString(row.title, "Cooperative Photo"),
    description: asString(row.caption, "Published cooperative gallery photo."),
    image: resolveMediaPath(asString(row.imagePath, "/images/Other%20Landing%20Page/About.jpg")),
    area: `published-${index}`,
    areaClass: areaClasses[index],
  }));
}

export function mapPublishedCertifications(rows: PublishedLandingRow[]) {
  return rows
    .filter((row) => ["Certification", "Accreditation", "Recognition"].includes(asString(row.recordType)))
    .map((row) => {
      const image = resolveMediaPath(asString(row.logoPath, "/images/Other%20Landing%20Page/Certification.jpg"));
      return {
        title: asString(row.name, "Certification"),
        tag: `${asString(row.name, "Certification")} (${asString(row.recordType, "Record")})`,
        image,
        fileType: isPdfPath(image) ? "pdf" : "image",
        aspectRatio: 3 / 4,
        maxWidth: 620,
      };
    });
}
