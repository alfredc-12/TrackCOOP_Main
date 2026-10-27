import type { AuthContext } from "../auth/auth.types";
import { createSeasonRepository, type SeasonRepository } from "./season.repository";
import type { ProductionListQuery, ProductionRecordInput, SeasonInput, SeasonListQuery, SeasonalAnalyticsQuery } from "./season.types";

export interface SeasonService {
  list(query: SeasonListQuery): ReturnType<SeasonRepository["list"]>;
  get(id: string): ReturnType<SeasonRepository["get"]>;
  create(input: SeasonInput, auth: AuthContext): ReturnType<SeasonRepository["create"]>;
  transition(id: string, action: "activate" | "close", auth: AuthContext): ReturnType<SeasonRepository["transition"]>;
  listProduction(query: ProductionListQuery): ReturnType<SeasonRepository["listProduction"]>;
  createProduction(input: ProductionRecordInput, auth: AuthContext): ReturnType<SeasonRepository["createProduction"]>;
  analytics(query: SeasonalAnalyticsQuery): ReturnType<SeasonRepository["analytics"]>;
}

export function createSeasonService(repository: SeasonRepository = createSeasonRepository()): SeasonService {
  return {
    list: (query) => repository.list(query),
    get: (id) => repository.get(id),
    create: (input, auth) => repository.create(input, auth),
    transition: (id, action, auth) => repository.transition(id, action, auth),
    listProduction: (query) => repository.listProduction(query),
    createProduction: (input, auth) => repository.createProduction(input, auth),
    analytics: (query) => repository.analytics(query),
  };
}
