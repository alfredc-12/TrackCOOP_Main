import type { AuthContext } from "../auth/auth.types";
import {
  createLandingRepository,
  type LandingRepository,
} from "./landing.repository";
import type { GallerySlotInput, LandingCollection, LandingListQuery } from "./landing.types";

export interface LandingService {
  publicLanding(): ReturnType<LandingRepository["publicLanding"]>;
  list(collection: LandingCollection, query: LandingListQuery): ReturnType<LandingRepository["list"]>;
  create(collection: LandingCollection, input: Record<string, unknown>, auth: AuthContext): ReturnType<LandingRepository["create"]>;
  update(collection: LandingCollection, id: string, input: Record<string, unknown>, auth: AuthContext): ReturnType<LandingRepository["update"]>;
  updateGallerySlot(slotKey: string, input: GallerySlotInput, auth: AuthContext): ReturnType<LandingRepository["updateGallerySlot"]>;
  listSettings(query: LandingListQuery): ReturnType<LandingRepository["listSettings"]>;
  upsertSetting(input: Record<string, unknown>, auth: AuthContext): ReturnType<LandingRepository["upsertSetting"]>;
  listAuditLogs(query: LandingListQuery): ReturnType<LandingRepository["listAuditLogs"]>;
}

export function createLandingService(
  repository: LandingRepository = createLandingRepository(),
): LandingService {
  return {
    publicLanding() {
      return repository.publicLanding();
    },
    list(collection, query) {
      return repository.list(collection, query);
    },
    create(collection, input, auth) {
      return repository.create(collection, input, auth);
    },
    update(collection, id, input, auth) {
      return repository.update(collection, id, input, auth);
    },
    updateGallerySlot(slotKey, input, auth) {
      return repository.updateGallerySlot(slotKey, input, auth);
    },
    listSettings(query) {
      return repository.listSettings(query);
    },
    upsertSetting(input, auth) {
      return repository.upsertSetting(input, auth);
    },
    listAuditLogs(query) {
      return repository.listAuditLogs(query);
    },
  };
}
