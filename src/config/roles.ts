export const roles = ["chairman", "bookkeeper", "member"] as const;

export type Role = (typeof roles)[number];
