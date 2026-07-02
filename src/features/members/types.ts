export type MemberStatus = "Current" | "Review" | "New";

export type Member = {
  id: string;
  name: string;
  sector: string;
  location: string;
  status: MemberStatus;
};
