import { resolveUploadUrl } from "@/lib/upload-url";
import type { PublicAnnouncement } from "./types";

export function announcementContent(post: PublicAnnouncement) {
  return post.message ?? post.content ?? "";
}

export function announcementDate(post: PublicAnnouncement) {
  return post.createdAt ?? post.postedAt;
}

export function formatAnnouncementDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function announcementText(content: string) {
  if (typeof document === "undefined") return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = content;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function announcementPreview(post: PublicAnnouncement) {
  const text = announcementText(announcementContent(post));
  return text.length > 140 ? `${text.slice(0, 140).trim()}…` : text;
}

export function announcementImages(post: PublicAnnouncement) {
  const paths = post.images?.length ? post.images : post.featuredImagePath ? [post.featuredImagePath] : [];
  return paths.map((path) => resolveUploadUrl(path)).filter((path): path is string => Boolean(path));
}
