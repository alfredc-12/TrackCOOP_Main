export function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function formatRentalDate(value?: string, long = false) {
  if (!value) return "Not set";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
    ...(value.includes("T") ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function maskReference(value?: string) {
  if (!value) return "—";
  return value.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export function toCsv(rows: Array<Record<string, string | number | undefined>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}
