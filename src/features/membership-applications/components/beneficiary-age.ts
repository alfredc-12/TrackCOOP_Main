export function calculateAgeFromBirthDate(value?: string | null, referenceDate = new Date()) {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnlyMatch) return null;

  const [, yearText, monthText, dayText] = dateOnlyMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day ||
    birthDate > referenceDate
  ) {
    return null;
  }

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    referenceDate.getMonth() > birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() &&
      referenceDate.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;

  return age >= 0 && age <= 130 ? age : null;
}
