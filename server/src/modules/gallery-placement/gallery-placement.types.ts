export type PhotoSource = "gallery" | "announcement";
export type PhotoReference = { source: PhotoSource; photoId: string };
export type LibraryPhoto = PhotoReference & {
  id: string;
  groupId: string;
  imagePath: string;
  thumbnailPath: string | null;
  altText: string;
  eligible: boolean;
  unavailableReason: string | null;
};
export type LibraryGroup = {
  id: string;
  source: PhotoSource;
  groupId: string;
  title: string;
  status: string;
  date: string;
  dateLabel: "Uploaded" | "Published" | "Created";
  activityDate: string | null;
  photoCount: number;
  eligible: boolean;
  photos: LibraryPhoto[];
};
export type PlacementSlot = {
  position: number;
  photo: LibraryPhoto | null;
  unavailable: boolean;
};
export type PlacementSnapshot = { revision: string; slots: PlacementSlot[] };
export type PlacementInput = {
  expectedRevision: string;
  slots: Array<{ position: number; photo: PhotoReference | null }>;
};
export type LibraryQuery = {
  source: "all" | PhotoSource;
  search: string;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
};
