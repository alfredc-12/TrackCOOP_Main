export type Payment = {
  id: string;
  memberId: string;
  type: string;
  amount: number;
  status: "Posted" | "Pending" | "Review";
};
