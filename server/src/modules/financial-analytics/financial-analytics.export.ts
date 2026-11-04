import JSZip from "jszip";
import type { FinancialAnalyticsResult, PeriodDetail, SourceCategoryMatrix } from "./financial-analytics.types";

type Cell = string | number | boolean | null | undefined;
export type Sheet = { name: string; rows: Cell[][] };

const xml = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * Cells are written as explicit inline strings so a spreadsheet never evaluates them, and text that would
 * begin a formula (= + - @ or a control character) is additionally prefixed so legacy importers stay safe.
 */
export function safeCell(value: Cell): string | number {
  if (typeof value === "number") return Number.isFinite(value) ? value : "N/A";
  if (value === null || value === undefined) return "N/A";
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
const sheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
const pct = (value: number | null) => (value === null ? "N/A" : value);

export async function buildWorkbook(sheets: Sheet[]) {
  const zip = new JSZip();
  const names = sheets.map(sheet => sheetName(sheet.name));
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`);
  sheets.forEach((sheet, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows.map((row, j) => `<row r="${j + 1}">${row.map(value => { const cell = safeCell(value); return typeof cell === "number" ? `<c><v>${cell}</v></c>` : `<c t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`; }).join("")}</row>`).join("")}</sheetData></worksheet>`));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function contextSheet(report: FinancialAnalyticsResult, title: string): Sheet {
  const f = report.filters;
  return { name: "Report context", rows: [
    [title, "Operational analytics from recorded ledger entries. Not an official CDA financial statement and not audited."],
    ["Generated (UTC)", report.metadata.generatedAt],
    ["Time zone", "Asia/Manila (calendar dates are inclusive)"],
    ["Reporting period", `${report.periodLabel} (${f.period})`],
    ["Comparison period", report.comparison.enabled ? `${report.comparisonLabel} — ${report.comparison.label}` : `None. ${report.comparison.note ?? ""}`.trim()],
    ["Comparison note", report.comparison.note ?? "None"],
    ["Record type", f.recordType === "all" ? "All eligible operating records" : f.recordType],
    ["Categories", f.categoryIds.length ? f.categoryIds.map(id => report.options.categories.find(c => c.id === id)?.name ?? id).join(", ") : "All"],
    ["Source modules", f.sourceModules.length ? f.sourceModules.join(", ") : "All operating source modules"],
    ["Amount range", `${f.minAmount ?? "no minimum"} to ${f.maxAmount ?? "no maximum"}`],
    ["Reference search", f.reference || "None"],
    ["Eligible records in scope (all time)", report.metadata.eligibleRecordCount],
    ["Ledger coverage begins", report.metadata.firstRecordDate ?? "No eligible records"],
    [],
    ["Metric definitions"], ...report.metadata.definitions.map(d => [d.metric, d.definition]),
    [], ["Data-quality notes and limitations"], ...report.metadata.limitations.map(l => [l.code, l.message]),
    ...report.recordIntegrity.issues.filter(i => !i.available).map(i => [i.code, i.limitation ?? "Unavailable"]),
  ] };
}

const matrixSheet = (matrix: SourceCategoryMatrix): Sheet => ({
  name: `${matrix.classification} matrix`,
  rows: [
    [`${matrix.classification}: category × source module (amounts in PHP)`],
    ["Category", ...matrix.sources.flatMap(s => [`${s} amount`, `${s} records`, `${s} previous`]), "Total", "Previous total", "Change"],
    ...matrix.rows.map(row => [row.name, ...matrix.sources.flatMap(s => [row.cells[s].amount, row.cells[s].count, row.cells[s].previousAmount]), row.total, row.previousTotal, row.change]),
    ["Source totals", ...matrix.sources.flatMap(s => [matrix.sourceTotals[s].amount, matrix.sourceTotals[s].count, matrix.sourceTotals[s].previousAmount]), matrix.total, matrix.previousTotal, matrix.previousTotal === null ? null : Math.round((matrix.total - matrix.previousTotal) * 100) / 100],
    [],
    ["Reconciliation", `Matrix total ${matrix.total} equals eligible ${matrix.classification.toLowerCase()} total for the same filters`, matrix.reconciles ? "Reconciled" : "MISMATCH"],
  ],
});

const shareSheet = (name: string, label: string, total: number, rows: FinancialAnalyticsResult["incomeSources"]["rows"]): Sheet => ({
  name,
  rows: [
    [label, "Amount (PHP)", "Share of total %", "Records", "Comparison amount", "Change", "Change %", "New vs comparison"],
    ...rows.map(r => [r.name, r.amount, pct(r.share), r.recordCount, r.previousAmount, r.change, pct(r.changePct), r.isNew ? "Yes" : "No"]),
    [],
    ["Total of rows", rows.reduce((t, r) => t + Math.round(r.amount * 100), 0) / 100],
    ["Eligible total", total],
    ["Difference", Math.round((total - rows.reduce((t, r) => t + r.amount, 0)) * 100) / 100],
  ],
});

export function reportSheets(report: FinancialAnalyticsResult, matrices: { income: SourceCategoryMatrix; expense: SourceCategoryMatrix }): Sheet[] {
  const o = report.overview; const b = report.netSurplusBridge;
  return [
    contextSheet(report, "Financial Analytics Summary"),
    { name: "Financial Analytics Summary", rows: [
      ["Metric", "Reporting period", "Comparison period", "Change", "Change %"],
      ["Recorded Operating Income", o.income, o.previous?.income, o.incomeChange, pct(o.incomeChangePct)],
      ["Recorded Operating Expenses", o.expenses, o.previous?.expenses, o.expenseChange, pct(o.expenseChangePct)],
      ["Recorded Net Surplus (indicative)", o.net, o.previous?.net, o.netChange, pct(o.netChangePct)],
      ["Recorded Surplus Margin %", pct(o.margin), o.previous ? pct(o.previous.margin) : null, o.marginChangePoints, "percentage points"],
      ["Eligible income records", o.incomeCount], ["Eligible expense records", o.expenseCount],
      [], ["Capital information (separate from operating results)"],
      ["Total share capital balance", report.capitalContext.totalBalance], ["Capital added in period", report.capitalContext.addedInPeriod],
      ["Member contributions", report.capitalContext.memberContributions], ["Interest additions", report.capitalContext.interestAdditions],
      ["Share-capital income kept out of operating totals", report.capitalContext.excludedIncome], ["Share-capital expense kept out of operating totals", report.capitalContext.excludedExpense],
    ] },
    shareSheet("Income by Source", "Source module", report.incomeSources.total, report.incomeSources.rows),
    shareSheet("Income by Category", "Category", report.incomeCategories.total, report.incomeCategories.rows),
    shareSheet("Expense by Category", "Category", report.expenseCategories.total, report.expenseCategories.rows),
    { name: "Net Surplus Comparison", rows: b.available ? [
      ["Previous net surplus", b.previousNet], ["Current net surplus", b.currentNet], ["Total change", b.totalChange], ["Income change", b.incomeChange], ["Expense change", b.expenseChange],
      [], ["Type", "Category", "Current", "Comparison", "Effect on net surplus", "Share of change %", "Status"],
      ...b.drivers.map(d => [d.type, d.name, d.current, d.previous, d.effect, pct(d.share), d.status]),
      [], ["Reconciliation", "Previous net surplus + signed drivers = current net surplus", Math.round((b.previousNet + b.drivers.reduce((t, d) => t + Math.round(d.effect * 100), 0) / 100) * 100) / 100, b.currentNet],
    ] : [["Net surplus comparison unavailable", b.reason ?? ""]] },
    { name: "Performance Trend", rows: [
      [`Granularity: ${report.performanceTrend.granularity}`], ["Period", "From", "To", "Income", "Expenses", "Net surplus", "Records", "Comparison income", "Comparison expenses", "Comparison net"],
      ...report.performanceTrend.points.map(p => [p.label, p.from, p.to, p.income, p.expenses, p.net, p.recordCount, p.previous?.income, p.previous?.expenses, p.previous?.net]),
    ] },
    matrixSheet(matrices.income), matrixSheet(matrices.expense),
    { name: "Financial Seasonality", rows: [
      [report.seasonalPatterns.statement], ["Complete months", report.seasonalPatterns.completeMonths], ["Years observed", report.seasonalPatterns.yearsObserved],
      ["Month", "Observations", "Income avg", "Income median", "Expense avg", "Expense median", "Net avg", "Net median"],
      ...report.seasonalPatterns.months.map(m => [m.name, m.observations, m.incomeAverage, m.incomeMedian, m.expenseAverage, m.expenseMedian, m.netAverage, m.netMedian]),
      [], ["Year", "Month", "Income", "Expenses", "Net", "Complete month"], ...report.seasonalPatterns.grid.map(g => [g.year, g.month, g.income, g.expenses, g.net, g.complete ? "Yes" : "No"]),
    ] },
    { name: "Financial Record Integrity", rows: [
      ["Posted operating records in period", report.recordIntegrity.postedCount], [],
      ["Check", "Status", "Records", "Amount", "Rule", "Limitation", "Affected references (up to 25)"],
      ...report.recordIntegrity.issues.map(i => [i.title, i.available ? i.label : "Not checked", i.count, i.amount, i.rule, i.limitation, i.references.map(r => r.reference).join("; ")]),
      [], ["Module", "Operational basis", "Operational amount", "Ledger amount", "Difference", "Caveat"],
      ...report.recordIntegrity.reconciliation.map(r => [r.module, r.operationalLabel, r.operationalAmount, r.postedAmount, r.difference, r.caveat]),
    ] },
    { name: "Insights", rows: [["Observation", "Value", "Reporting period", "Comparison period", "Calculation", "Caveat"], ...report.insights.map(i => [i.title, i.value, i.period, i.comparisonPeriod, i.explanation, i.caveat])] },
  ];
}

export function periodSheets(report: FinancialAnalyticsResult, detail: PeriodDetail): Sheet[] {
  return [
    contextSheet(report, "Financial Performance Period Summary"),
    { name: "Period summary", rows: [
      ["From", detail.from], ["To", detail.to], ["Income", detail.income], ["Expenses", detail.expenses], ["Net surplus", detail.net], ["Eligible records", detail.recordCount],
      ["Preceding equal-length period income", detail.previous?.income], ["Preceding equal-length period expenses", detail.previous?.expenses], ["Preceding equal-length period net", detail.previous?.net],
      [], ["Income category", "Amount", "Records"], ...detail.incomeCategories.map(c => [c.name, c.amount, c.count]),
      [], ["Expense category", "Amount", "Records"], ...detail.expenseCategories.map(c => [c.name, c.amount, c.count]),
      [], ["Source module", "Income", "Expenses"], ...detail.sources.map(s => [s.source, s.income, s.expenses]),
      [], ["Date", "Income", "Expenses", "Net", "Records"], ...detail.daily.map(d => [d.date, d.income, d.expenses, d.net, d.count]),
    ] },
  ];
}

export function matrixSheets(report: FinancialAnalyticsResult, matrices: { income: SourceCategoryMatrix; expense: SourceCategoryMatrix }): Sheet[] {
  return [contextSheet(report, "Income and Expense Source × Category Matrix"), matrixSheet(matrices.income), matrixSheet(matrices.expense)];
}
