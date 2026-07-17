export const roles = ["admin", "staff", "viewer"] as const;

export type Role = (typeof roles)[number];
