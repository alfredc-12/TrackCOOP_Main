import type { AuthContext } from "../auth/auth.types";
import {
  createMemberSelfRepository,
  type MemberSelfRepository,
} from "./member-self.repository";
import type {
  MemberActivityQuery,
  MemberPasswordInput,
  MemberProfileInput,
  MemberSupportInput,
} from "./member-self.types";

export interface MemberSelfService {
  dashboard(auth: AuthContext): ReturnType<MemberSelfRepository["dashboard"]>;
  activity(auth: AuthContext, query: MemberActivityQuery): ReturnType<MemberSelfRepository["activity"]>;
  profile(auth: AuthContext): ReturnType<MemberSelfRepository["profile"]>;
  updateProfile(auth: AuthContext, input: MemberProfileInput): ReturnType<MemberSelfRepository["updateProfile"]>;
  updatePassword(auth: AuthContext, input: MemberPasswordInput): ReturnType<MemberSelfRepository["updatePassword"]>;
  listSupportTickets(auth: AuthContext): ReturnType<MemberSelfRepository["listSupportTickets"]>;
  createSupportTicket(auth: AuthContext, input: MemberSupportInput): ReturnType<MemberSelfRepository["createSupportTicket"]>;
}

export function createMemberSelfService(
  repository: MemberSelfRepository = createMemberSelfRepository(),
): MemberSelfService {
  return {
    dashboard: (auth) => repository.dashboard(auth),
    activity: (auth, query) => repository.activity(auth, query),
    profile: (auth) => repository.profile(auth),
    updateProfile: (auth, input) => repository.updateProfile(auth, input),
    updatePassword: (auth, input) => repository.updatePassword(auth, input),
    listSupportTickets: (auth) => repository.listSupportTickets(auth),
    createSupportTicket: (auth, input) => repository.createSupportTicket(auth, input),
  };
}
