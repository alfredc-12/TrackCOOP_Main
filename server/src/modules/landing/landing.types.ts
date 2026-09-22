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
};
