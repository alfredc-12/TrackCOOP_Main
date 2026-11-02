import PDFDocument from "pdfkit";
import { createRfmWorkbook } from "../member-indicators/member-indicator.export";

/**
 * Format-neutral report model. The same sections feed the Excel workbook (one sheet each) and the PDF, so
 * the two formats can never disagree about a number.
 */
export type ReportColumn = { key: string; label: string; kind: "text" | "money" | "number" | "percent"; weight?: number };
export type ReportRow = Record<string, string | number | null>;
export type ReportSection = { title: string; note?: string; columns: ReportColumn[]; rows: ReportRow[] };
export type ReportDocument = {
  title: string;
  cooperative: string;
  meta: Array<[string, string]>;
  sections: ReportSection[];
};

type Cell = string | number | null | { value: number; style: number };

function sheetName(title: string, used: Set<string>) {
  const base = title.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Sheet";
  let name = base;
  for (let index = 2; used.has(name.toLowerCase()); index += 1) name = `${base.slice(0, 26)} ${index}`;
  used.add(name.toLowerCase());
  return name;
}

function cellFor(column: ReportColumn, value: string | number | null): Cell {
  if (value === null || value === undefined || value === "") return null;
  if (column.kind === "money" && typeof value === "number") return { value, style: 2 };
  if ((column.kind === "number" || column.kind === "percent") && typeof value === "number") return value;
  return String(value);
}

export async function renderReportXlsx(report: ReportDocument) {
  const used = new Set<string>();
  const sheets: Array<{ name: string; rows: Cell[][] }> = [
    { name: sheetName("Report info", used), rows: [["Item", "Value"], ...report.meta.map(([key, value]): Cell[] => [key, value])] },
  ];
  for (const section of report.sections) {
    sheets.push({
      name: sheetName(section.title, used),
      rows: [
        section.columns.map((column) => column.label),
        ...section.rows.map((row) => section.columns.map((column) => cellFor(column, row[column.key] ?? null))),
      ],
    });
  }
  return createRfmWorkbook(sheets);
}

export function pesoText(value: number) {
  return `PHP ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function displayValue(column: ReportColumn, value: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  if (column.kind === "money" && typeof value === "number") return pesoText(value);
  if (column.kind === "percent" && typeof value === "number") return `${value}%`;
  if (column.kind === "number" && typeof value === "number") return new Intl.NumberFormat("en-PH").format(value);
  return String(value);
}

export function renderReportPdf(report: ReportDocument) {
  const document = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const bottom = document.page.height - document.page.margins.bottom - 20;

  document.rect(0, 0, document.page.width, 62).fill("#123D2A");
  document.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(report.cooperative, left, 20, { width });
  document.fillColor("#D8A011").fontSize(8).text("SYSTEM-GENERATED EXPENSE REPORT - NOT AN AUDITED FINANCIAL STATEMENT", left, 36, { width });
  document.y = 80;
  document.fillColor("#123D2A").font("Helvetica-Bold").fontSize(18).text(report.title, left, document.y, { width });
  document.moveDown(0.5);
  for (const [key, value] of report.meta) {
    if (document.y > bottom - 14) document.addPage();
    const y = document.y;
    document.font("Helvetica-Bold").fontSize(8).fillColor("#52675A").text(key, left, y, { width: 150 });
    const height = document.font("Helvetica").fontSize(8).heightOfString(value, { width: width - 160 });
    document.fillColor("#17211C").text(value, left + 160, y, { width: width - 160 });
    document.y = y + Math.max(height, 10) + 3;
  }

  for (const section of report.sections) {
    if (document.y > bottom - 60) document.addPage();
    document.moveDown(0.8);
    document.font("Helvetica-Bold").fontSize(11).fillColor("#123D2A").text(section.title, left, document.y, { width });
    if (section.note) document.font("Helvetica").fontSize(8).fillColor("#52675A").text(section.note, left, document.y + 2, { width });
    document.moveDown(0.3);

    const weights = section.columns.map((column) => column.weight ?? (column.kind === "text" ? 2 : 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (weight / totalWeight) * width);
    const header = () => {
      const y = document.y;
      document.rect(left, y, width, 18).fill("#E7F2E4");
      let x = left;
      section.columns.forEach((column, index) => {
        document.fillColor("#123D2A").font("Helvetica-Bold").fontSize(7.5).text(column.label, x + 4, y + 5, { width: widths[index] - 8, lineBreak: false, ellipsis: true, align: column.kind === "text" ? "left" : "right" });
        x += widths[index];
      });
      document.y = y + 20;
    };
    header();
    if (section.rows.length === 0) {
      document.font("Helvetica").fontSize(8).fillColor("#52675A").text("No rows for the selected filters.", left + 4, document.y + 2, { width });
      document.moveDown(0.8);
      continue;
    }
    for (const row of section.rows) {
      if (document.y + 16 > bottom) {
        document.addPage();
        header();
      }
      const y = document.y;
      let x = left;
      section.columns.forEach((column, index) => {
        document.fillColor("#17211C").font("Helvetica").fontSize(7.5).text(displayValue(column, row[column.key] ?? null), x + 4, y + 3, { width: widths[index] - 8, lineBreak: false, ellipsis: true, align: column.kind === "text" ? "left" : "right" });
        x += widths[index];
      });
      document.moveTo(left, y + 14).lineTo(left + width, y + 14).strokeColor("#E1E8E2").lineWidth(0.5).stroke();
      document.y = y + 16;
    }
  }

  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    document.font("Helvetica").fontSize(7).fillColor("#6C7A70").text(
      `Page ${index - pages.start + 1} of ${pages.count} | ${report.title} | TrackCOOP system-generated document`,
      left,
      document.page.height - 28,
      { width, align: "center", lineBreak: false },
    );
  }
  document.end();
  return finished;
}
