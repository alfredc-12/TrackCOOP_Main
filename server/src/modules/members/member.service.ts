import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createMemberRepository,
  type MemberRepository,
} from "./member.repository";
import type {
  ApprovalStatus,
  MemberListQuery,
  MemberProfileInput,
  MembershipType,
  OfficialMemberStatus,
  UpdateMemberProfileInput,
} from "./member.types";

export interface MemberService {
  listMembers(query: MemberListQuery): ReturnType<MemberRepository["list"]>;
  getMember(memberId: string): ReturnType<MemberRepository["findById"]>;
  createMember(input: MemberProfileInput, auth: AuthContext): ReturnType<MemberRepository["create"]>;
  updateMember(memberId: string, input: UpdateMemberProfileInput, auth: AuthContext): ReturnType<MemberRepository["update"]>;
  updateApproval(memberId: string, approvalStatus: ApprovalStatus, reason: string | null | undefined, auth: AuthContext): ReturnType<MemberRepository["updateApproval"]>;
  updateStatus(memberId: string, input: { membershipType?: MembershipType; officialMemberStatus?: OfficialMemberStatus; reason: string }, auth: AuthContext): ReturnType<MemberRepository["updateStatus"]>;
  statusHistory(memberId: string): ReturnType<MemberRepository["history"]>;
  summary(): ReturnType<MemberRepository["summary"]>;
  barangayDistribution(): ReturnType<MemberRepository["barangayDistribution"]>;
}

export function createMemberService(
  repository: MemberRepository = createMemberRepository(),
): MemberService {
  return {
    listMembers(query) {
      return repository.list(query);
    },

    getMember(memberId) {
      return repository.findById(memberId);
    },

    createMember(input, auth) {
      return repository.create(input, auth);
    },

    updateMember(memberId, input, auth) {
      return repository.update(memberId, input, auth);
    },

    updateApproval(memberId, approvalStatus, reason, auth) {
      return repository.updateApproval(memberId, approvalStatus, reason, auth);
    },

    async updateStatus(memberId, input, auth) {
      const member = await repository.findById(memberId);

      if (!member) {
        throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
      }

      if (
        input.membershipType === member.membershipType &&
        input.officialMemberStatus === member.officialMemberStatus
      ) {
        throw new AppError(
          "No membership status change was provided",
          400,
          "MEMBER_STATUS_UNCHANGED",
        );
      }

      return repository.updateStatus(memberId, input, auth);
    },

    statusHistory(memberId) {
      return repository.history(memberId);
    },

    summary() {
      return repository.summary();
    },

    barangayDistribution() {
      return repository.barangayDistribution();
    },
  };
}
