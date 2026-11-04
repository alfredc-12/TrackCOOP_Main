"use client";

import { useEffect, useState } from "react";
import { env } from "@/config/env";
import { resolveUploadUrl } from "@/lib/upload-url";

export type PublishedLandingRow = Record<string, unknown> & {
  id: string;
};

export type RecentLandingPhoto = {
  id: string;
  source: "gallery" | "announcement";
  title: string;
  caption: string;
  imagePath: string;
  publishedAt: string;
};

type PublishedLandingPayload = {
  landingPhotos: import("./LandingPhotoLightbox").LandingPhoto[];
  partners: PublishedLandingRow[];
  gallery: PublishedLandingRow[];
  recentPhotos: RecentLandingPhoto[];
};

const emptyPayload: PublishedLandingPayload = {
  landingPhotos: [],
  partners: [],
  gallery: [],
  recentPhotos: [],
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

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
        if (!response.ok || !payload.success || !payload.data) throw new Error("Landing content unavailable");
        if (controller.signal.aborted) return;
        setContent({ ...payload.data, recentPhotos: payload.data.recentPhotos ?? [], landingPhotos: payload.data.landingPhotos ?? [] });
        setLoadError(false);
      } catch {
        if (controller.signal.aborted) return;
        setContent(emptyPayload);
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [retryKey]);

  return {
    ...content,
    isLoading,
    loadError,
    retry() {
      setIsLoading(true);
      setLoadError(false);
      setRetryKey((key) => key + 1);
    },
  };
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
