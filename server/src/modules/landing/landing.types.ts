import type { LibraryPhoto } from "../gallery-placement/gallery-placement.types";

export type PublicLandingStats = {
  activeFarmerMembers: number;
  farmCommunitiesReached: number;
  fisheryMembers: number;
  annualPrograms: number;
};

export type LandingCollection =
  | "partners"
  | "gallery";

export type LandingListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
};

export type LandingListResult<T> = {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type LandingRow = Record<string, unknown> & {
  id: string;
};

export type GallerySlotInput = {
  galleryGroupId?: string | null;
  galleryImageId?: string | null;
  displayOrder: number;
};

export type PublicLandingPayload = {
  partners: LandingRow[];
  gallery: LandingRow[];
  recentPhotos: RecentLandingPhoto[];
  stats: PublicLandingStats;
  landingPhotos?: Array<LibraryPhoto & { position: number }>;
};

export type RecentLandingPhoto = {
  id: string;
  source: "gallery" | "announcement";
  title: string;
  caption: string;
  imagePath: string;
  publishedAt: string;
};
