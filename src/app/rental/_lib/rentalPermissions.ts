import type { UserRole } from "../_types/rental";

export type RentalCapability =
  | "public"
  | "dashboard"
  | "services"
  | "inquiries"
  | "schedule"
  | "availability"
  | "operations"
  | "payments"
  | "expenses"
  | "reports"
  | "analytics"
  | "audit"
  | "settings"
  | "member";

const access: Record<RentalCapability, UserRole[]> = {
  public: ["Chairman", "Bookkeeper", "Member", "Public"],
  dashboard: ["Chairman", "Bookkeeper"],
  services: ["Chairman"],
  inquiries: ["Chairman"],
  schedule: ["Chairman"],
  availability: ["Chairman"],
  operations: ["Chairman"],
  payments: ["Bookkeeper"],
  expenses: ["Bookkeeper"],
  reports: ["Chairman", "Bookkeeper"],
  analytics: ["Chairman"],
  audit: ["Chairman"],
  settings: ["Chairman"],
  member: ["Member"],
};

export function canAccessRental(role: UserRole, capability: RentalCapability) {
  return access[capability].includes(role);
}

export function adaptTrackCoopRole(role?: string): UserRole {
  if (role === "chairman") return "Chairman";
  if (role === "bookkeeper") return "Bookkeeper";
  if (role === "member") return "Member";
  return "Public";
}

export function roleFromQuery(value: string | null): UserRole | undefined {
  const roles: UserRole[] = ["Chairman", "Bookkeeper", "Member", "Public"];
  return roles.find((role) => role.toLowerCase() === value?.toLowerCase());
}
