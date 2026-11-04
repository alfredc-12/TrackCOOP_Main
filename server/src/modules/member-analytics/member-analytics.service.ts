import { createMemberRepository, type MemberRepository } from "../members/member.repository";
import type { MemberListQuery } from "../members/member.types";
import { createAnalyticsEngine } from "./member-analytics.engine";
import { createMemberAnalyticsRepository } from "./member-analytics.repository";
import type { AnalyticsFilters, AnalyticsSelection } from "./member-analytics.types";

export function createMemberAnalyticsService(repository = createMemberAnalyticsRepository(), directory: Pick<MemberRepository, "list"> = createMemberRepository()) {
  return {
    async report(filters: AnalyticsFilters) { return createAnalyticsEngine(await repository.load(filters), filters).result; },
    async matching(filters: AnalyticsFilters, selection: AnalyticsSelection, query: MemberListQuery) {
      const engine = createAnalyticsEngine(await repository.load(filters), filters);
      return directory.list({ ...query, memberIds: engine.matchingIds(selection) });
    },
  };
}
export type MemberAnalyticsService = ReturnType<typeof createMemberAnalyticsService>;
