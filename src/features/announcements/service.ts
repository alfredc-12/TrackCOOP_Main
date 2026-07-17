import announcementsData from "./data/announcements.json";
import type { Announcement } from "./types";

function sortByLatestPostedAt(a: Announcement, b: Announcement) {
  const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
  const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;

  return bTime - aTime;
}

export function getAnnouncements(): Announcement[] {
  return [...(announcementsData as Announcement[])].sort(sortByLatestPostedAt);
}
