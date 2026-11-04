import { apiRequest } from "@/lib/api-client";
export type {
  LibraryPhoto,
  LibraryGroup,
  PhotoReference,
  PhotoSource,
  PlacementSnapshot,
  PlacementSlot,
} from "../../../server/src/modules/gallery-placement/gallery-placement.types";
import type {
  LibraryQuery,
  LibraryGroup,
  LibraryPhoto,
  PlacementSnapshot,
  PlacementInput,
} from "../../../server/src/modules/gallery-placement/gallery-placement.types";
export const readPlacement = () =>
  apiRequest<PlacementSnapshot>("/api/landing/gallery-placement", {
    cache: "no-store",
  });
export const readLibrary = (q: LibraryQuery, signal?: AbortSignal) =>
  apiRequest<{
    groups: LibraryGroup[];
    total: number;
    page: number;
    pageSize: number;
  }>(
    `/api/landing/gallery-library?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]))}`,
    { signal, cache: "no-store" },
  );
export const readGroupPhotos = (source: string, id: string, page = 1) =>
  apiRequest<{ photos: LibraryPhoto[]; hasMore: boolean }>(
    `/api/landing/gallery-library/${source}/${id}?page=${page}`,
  );
export const proposePlacement = (excluded: string[] = []) =>
  apiRequest<{ photos: LibraryPhoto[]; availablePositions: number }>(
    "/api/landing/gallery-placement/proposal",
    {
      method: "POST",
      body: JSON.stringify({ excluded: excluded.slice(0, 500) }),
      signal: AbortSignal.timeout(20000),
    },
  );
export const publishPlacement = (input: PlacementInput) =>
  apiRequest<PlacementSnapshot>("/api/landing/gallery-placement", {
    method: "PUT",
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
