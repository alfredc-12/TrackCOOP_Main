export type RentalDatabaseDate = string | Date;

function databaseDateText(value: RentalDatabaseDate) {
  return value instanceof Date ? value.toISOString() : value;
}

export function rentalDatePart(
  value: RentalDatabaseDate | null | undefined,
) {
  return value ? databaseDateText(value).slice(0, 10) : "";
}

export function rentalTimePart(
  value: RentalDatabaseDate | null | undefined,
) {
  const text = value ? databaseDateText(value) : "";
  return text.length >= 16 ? text.slice(11, 16) : "";
}

export function rentalIsoDateTime(
  value: RentalDatabaseDate | null | undefined,
) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value.includes("T") ? value : `${value.replace(" ", "T")}+08:00`;
}
