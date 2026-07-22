"use client";

import { useEffect, useState } from "react";
import { FileCheck2, Phone, Sprout, UsersRound, Waves, Wheat } from "lucide-react";
import { env } from "@/config/env";

export type PublishedLandingRow = Record<string, unknown> & {
  id: string;
};

type PublishedLandingPayload = {
  contentBlocks: PublishedLandingRow[];
  services: PublishedLandingRow[];
  programs: PublishedLandingRow[];
  partners: PublishedLandingRow[];
  gallery: PublishedLandingRow[];
};

const emptyPayload: PublishedLandingPayload = {
  contentBlocks: [],
  services: [],
  programs: [],
  partners: [],
  gallery: [],
};

const serviceIcons = [UsersRound, Wheat, FileCheck2, Phone, Sprout, Waves];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
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

export function mapPublishedServices(rows: PublishedLandingRow[]) {
  return rows.map((row, index) => ({
    title: asString(row.title, "Cooperative Service"),
    description: asString(row.shortDescription, "Published cooperative service."),
    cta: asString(row.ctaLabel, "Learn more"),
    href: asString(row.ctaUrl, "#contact"),
    icon: serviceIcons[index % serviceIcons.length],
  }));
}

export function mapPublishedProjects(rows: PublishedLandingRow[], areaClasses: string[]) {
  return rows.slice(0, areaClasses.length).map((row, index) => ({
    title: asString(row.title, "Cooperative Project"),
    description: asString(row.summary, "Published cooperative program or project."),
    image: asString(row.imagePath, "/images/Other%20Landing%20Page/About.jpg"),
    area: `published-${index}`,
    areaClass: areaClasses[index],
  }));
}

export function mapPublishedCertifications(rows: PublishedLandingRow[]) {
  return rows
    .filter((row) => ["Certification", "Accreditation", "Recognition"].includes(asString(row.recordType)))
    .map((row) => ({
      title: asString(row.name, "Certification"),
      tag: `${asString(row.name, "Certification")} (${asString(row.recordType, "Record")})`,
      image: asString(row.logoPath, "/images/Other%20Landing%20Page/Certification.jpg"),
      aspectRatio: 3 / 4,
      maxWidth: 620,
    }));
}
