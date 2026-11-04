/** Keep the chosen day when browsing, clamping short months and date limits. */
export function calendarDateInMonth(
  year: number,
  month: number,
  preferredDay: number,
  min?: string,
  max?: string,
) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const date = new Date(year, month, Math.min(preferredDay, lastDay));
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}
