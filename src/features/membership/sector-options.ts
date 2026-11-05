export const PRIMARY_SECTOR_OPTIONS = [
  "Rice",
  "Corn",
  "Fishery",
  "Livestock",
  "High-value crops (gulayan)",
  "Coffee",
] as const;

export type PrimarySector = (typeof PRIMARY_SECTOR_OPTIONS)[number];

export const PRIMARY_SECTOR_POLICY =
  "Members may select multiple agricultural sectors; a legacy primary designation is retained for existing integrations.";
