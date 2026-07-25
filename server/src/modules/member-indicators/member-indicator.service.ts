import {
  createMemberIndicatorRepository,
  type MemberIndicatorRepository,
} from "./member-indicator.repository";
import type {
  MemberIndicatorListQuery,
  RecalculateIndicatorsInput,
} from "./member-indicator.types";
import type { AuthContext } from "../auth/auth.types";

export interface MemberIndicatorService {
  listIndicators(query: MemberIndicatorListQuery): ReturnType<MemberIndicatorRepository["list"]>;
  getMemberIndicator(memberId: string): ReturnType<MemberIndicatorRepository["findLatestByMemberId"]>;
  getMemberIndicatorHistory(memberId: string): ReturnType<MemberIndicatorRepository["history"]>;
  summary(): ReturnType<MemberIndicatorRepository["summary"]>;
  recalculate(
    input: RecalculateIndicatorsInput,
    auth: AuthContext,
  ): ReturnType<MemberIndicatorRepository["recalculate"]>;
}

export function createMemberIndicatorService(
  repository: MemberIndicatorRepository = createMemberIndicatorRepository(),
): MemberIndicatorService {
  return {
    listIndicators(query) {
      return repository.list(query);
    },

    getMemberIndicator(memberId) {
      return repository.findLatestByMemberId(memberId);
    },

    getMemberIndicatorHistory(memberId) {
      return repository.history(memberId);
    },

    summary() {
      return repository.summary();
    },

    recalculate(input, auth) {
      return repository.recalculate(input, auth);
    },
  };
}
