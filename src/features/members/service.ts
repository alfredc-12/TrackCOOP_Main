import { getMemberById, listMembers } from "./repository";

export function getMembersOverview() {
  return listMembers();
}

export function getMemberProfile(id: string) {
  return getMemberById(id);
}
