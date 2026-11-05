import dataset from "./batangas-locations.json";
import { AppError } from "../../utils/app-error";
const normalized = (value: string) => value.trim().toLocaleLowerCase("en-PH");
export function membershipLocation(input: {
  municipality: string;
  barangay?: string | null;
  province: string;
  municipalityPsgc?: string | null;
  barangayPsgc?: string | null;
}) {
  const city = dataset.cities.find((c) =>
    input.municipalityPsgc
      ? c.code === input.municipalityPsgc
      : normalized(c.name) === normalized(input.municipality),
  );
  const barangay = city?.barangays.find((b) =>
    input.barangayPsgc
      ? b[0] === input.barangayPsgc
      : normalized(b[1]) === normalized(input.barangay ?? ""),
  );
  if (
    normalized(input.province) !== "batangas" ||
    !city ||
    !barangay ||
    normalized(city.name) !== normalized(input.municipality) ||
    normalized(barangay[1]) !== normalized(input.barangay ?? "")
  ) {
    throw new AppError(
      "Choose a matching Batangas municipality/city and barangay",
      400,
      "MEMBERSHIP_LOCATION_INVALID",
    );
  }
  return {
    municipality: city.name,
    barangay: barangay[1],
    province: "Batangas",
    municipalityPsgc: city.code,
    barangayPsgc: barangay[0],
  };
}
