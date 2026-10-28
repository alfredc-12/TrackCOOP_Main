export const PRIMARY_SECTOR_OPTIONS = [
  "Rice",
  "Corn",
  "Fishery",
  "Livestock",
  "High-value crops (gulayan)",
] as const;

export type PrimarySector = (typeof PRIMARY_SECTOR_OPTIONS)[number];

export const PRIMARY_SECTOR_POLICY =
  "Each member has one primary sector. A member may have no sector yet while the profile is incomplete, but multiple active sectors are not currently supported.";
