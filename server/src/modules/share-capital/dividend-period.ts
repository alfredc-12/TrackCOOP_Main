export const COMPLETE_FISCAL_YEAR_PERIOD_MESSAGE =
  "Coverage must span one complete fiscal year (12 months).";

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

/**
 * A declaration must cover one complete fiscal year. The default UI period
 * is Jan 1 to Dec 31, while this also supports a cooperative fiscal year
 * defined in its bylaws (for example, Jul 1 to Jun 30).
 */
export function isCompleteFiscalYearPeriod(coverageStart: string, coverageEnd: string) {
  const start = parseDateOnly(coverageStart);
  const end = parseDateOnly(coverageEnd);
  if (!start || !end) return false;

  const expectedEnd = new Date(Date.UTC(start.year + 1, start.month - 1, start.day));
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
  return formatDateOnly(expectedEnd) === coverageEnd;
}
