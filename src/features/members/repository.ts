import type { Member } from "./types";

export const members: Member[] = [
  { id: "M-1001", name: "Greenfields MPC", sector: "Agriculture", location: "Caraga", status: "Current" },
  { id: "M-1002", name: "Nueva Transport Coop", sector: "Transport", location: "Nueva Ecija", status: "Review" },
  { id: "M-1003", name: "Harbor Credit Union", sector: "Finance", location: "Cebu", status: "Current" },
  { id: "M-1004", name: "Upland Growers", sector: "Production", location: "Bukidnon", status: "New" },
];

export function listMembers() {
  return members;
}

export function getMemberById(id: string) {
  return members.find((member) => member.id === id);
}
