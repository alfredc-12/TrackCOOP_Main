export type LandingCollection =
  | "content-blocks"
  | "services"
  | "programs"
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

export type PublicLandingPayload = {
  contentBlocks: LandingRow[];
  services: LandingRow[];
  programs: LandingRow[];
  partners: LandingRow[];
  gallery: LandingRow[];
};
