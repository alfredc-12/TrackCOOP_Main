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
  public: ["Chairman", "Admin", "Bookkeeper", "Member", "Public"],
  dashboard: ["Chairman", "Admin", "Bookkeeper"],
  services: ["Admin"],
  inquiries: ["Chairman", "Admin"],
  schedule: ["Chairman", "Admin"],
  availability: ["Admin"],
  operations: ["Admin"],
  payments: ["Bookkeeper"],
  expenses: ["Bookkeeper"],
  reports: ["Chairman", "Bookkeeper"],
  analytics: ["Chairman"],
  audit: ["Chairman"],
  settings: ["Admin"],
  member: ["Member"],
};

export function canAccessRental(role: UserRole, capability: RentalCapability) {
  return access[capability].includes(role);
}

// Adapter for TrackCOOP's current demo authentication. Replace when authenticated role claims are available.
export function adaptTrackCoopRole(role?: string): UserRole {
  if (role === "admin" || role === "staff") return "Admin";
  if (role === "chairman") return "Chairman";
  if (role === "bookkeeper") return "Bookkeeper";
  if (role === "member") return "Member";
  return "Public";
}

export function roleFromQuery(value: string | null): UserRole | undefined {
  const roles: UserRole[] = ["Chairman", "Admin", "Bookkeeper", "Member", "Public"];
  return roles.find((role) => role.toLowerCase() === value?.toLowerCase());
}
