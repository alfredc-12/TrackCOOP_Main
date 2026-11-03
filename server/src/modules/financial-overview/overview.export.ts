import { AppError } from "../../utils/app-error";
import type { OverviewFilters } from "./overview.schema";
import type { OverviewRepository } from "./overview.repository";
import {
  renderReportPdf,
  renderReportXlsx,
  type ReportDocument,
  type ReportSection,
} from "../expense-overview/expense-report";
const column = (
  key: string,
  label: string,
  kind: "text" | "number" | "money" = "text",
) => ({ key, label, kind });
export async function overviewExport(
  repo: OverviewRepository,
  f: OverviewFilters,
  format: "xlsx" | "pdf",
) {
  return repo.snapshot(async (c) => {
    const report = await repo.report(c, f);
    if (format === "pdf") {
      const probe = await repo.list(c, { ...f, page: 1, pageSize: 1 });
      if (probe.total > 5000)
        throw new AppError(
          "PDF export exceeds 5,000 records. Narrow the filters or choose Excel.",
          422,
          "OVERVIEW_EXPORT_TOO_LARGE",
        );
    }
    const list = await repo.list(c, f, true);
    const sections: ReportSection[] = [
      {
        title: "Posted operating summary",
        columns: [
          column("metric", "Metric"),
          column("value", "PHP (exact decimal)", "money"),
          column("records", "Records", "number"),
        ],
        rows: [
          {
            metric: "Money In · posted operating income",
            value: report.summary.income,
            records: report.summary.incomeRecords,
          },
          {
            metric: "Money Out · posted operating expenses",
            value: report.summary.expense,
            records: report.summary.expenseRecords,
          },
          {
            metric: "Net operating result",
            value: report.summary.net,
            records: null,
          },
        ],
      },
      {
        title: "Period comparison",
        columns: [
          column("metric", "Metric"),
          column("previous", "Previous PHP", "money"),
          column("change", "Change PHP", "money"),
          column("percent", "Change %", "number"),
        ],
        rows: (["income", "expense", "net"] as const).map((key) => ({
          metric: key,
          previous: report.previous?.[key] ?? "N/A",
          change: report.changes[key].amount ?? "N/A",
          percent: report.changes[key].percent,
        })),
      },
      {
        title: "Income vs expenses trend",
        columns: [
          column("period", "Period"),
          column("start", "Start"),
          column("end", "End"),
          column("income", "Income PHP", "money"),
          column("expense", "Expenses PHP", "money"),
          column("net", "Net PHP", "money"),
          column("records", "Records", "number"),
        ],
        rows: report.trend.map((r) => ({
          period: r.label,
          start: r.startDate,
          end: r.endDate,
          income: r.income,
          expense: r.expense,
          net: r.net,
          records: r.records,
        })),
      },
      {
        title: "Income categories",
        columns: [
          column("name", "Category"),
          column("amount", "PHP", "money"),
          column("records", "Records", "number"),
          column("share", "Share %", "number"),
        ],
        rows: report.categories.income.map((r) => ({
          name: r.name,
          amount: r.amount,
          records: r.records,
          share: r.share,
        })),
      },
      {
        title: "Expense categories",
        columns: [
          column("name", "Category"),
          column("amount", "PHP", "money"),
          column("records", "Records", "number"),
          column("share", "Share %", "number"),
        ],
        rows: report.categories.expense.map((r) => ({
          name: r.name,
          amount: r.amount,
          records: r.records,
          share: r.share,
        })),
      },
      {
        title: "Source modules",
        columns: [
          column("source", "Source"),
          column("income", "Posted income PHP", "money"),
          column("expense", "Posted expenses PHP", "money"),
          column("net", "Recorded net PHP", "money"),
          column("records", "Records", "number"),
        ],
        rows: report.sources.map((r) => ({ ...r })),
      },
      {
        title: "Financial activity",
        columns: [
          column("date", "Record date"),
          column("number", "Record"),
          column("type", "Type"),
          column("category", "Category"),
          column("source", "Source"),
          column("amount", "Recorded PHP", "money"),
          column("posting", "Posting/status"),
          column("eligible", "In operating total"),
          column("description", "Description"),
        ],
        rows: list.items.map((r) => ({
          date: r.date,
          number: r.number,
          type: r.type,
          category: r.category,
          source: r.source,
          amount: r.amount,
          posting:
            r.status === "Active"
              ? r.posted
                ? "Posted"
                : "Unposted"
              : r.status,
          eligible: r.eligible ? "Yes" : "No",
          description: r.description,
        })),
      },
      {
        title: "Review indicators",
        columns: [
          column("metric", "Review condition"),
          column("records", "Records", "number"),
        ],
        rows: Object.entries(report.review).map(([metric, records]) => ({
          metric,
          records,
        })),
      },
    ];
    const document: ReportDocument = {
      title: "Financial Overview",
      wrapRows: true,
      banner:
        "SYSTEM-GENERATED FINANCIAL OVERVIEW - NOT AN AUDITED FINANCIAL STATEMENT",
      cooperative: "Nasugbu Farmers and Fisherfolks Agriculture Cooperative",
      meta: [
        [
          "Cooperative",
          "Nasugbu Farmers and Fisherfolks Agriculture Cooperative",
        ],
        ["Report title", "Financial Overview"],
        ["Generated UTC", report.generatedAt],
        [
          "Reporting period",
          `${report.period.effective.startDate ?? "All time"} to ${report.period.effective.endDate}`,
        ],
        [
          "Comparison",
          report.period.previous
            ? `${report.period.previous.startDate} to ${report.period.previous.endDate}`
            : "No comparison",
        ],
        [
          "Applied filters",
          JSON.stringify({ ...f, page: undefined, pageSize: undefined }),
        ],
        [
          "Financial basis",
          "Active approved Income/Expense ledger records, compatible categories, valid source relationships. Capital, internal transfers, principal, capital purchases, duplicate/superseded postings and Adjustments are excluded. Custom compatible categories remain supported.",
        ],
        [
          "Activity scope",
          "Audit, type and row-focus selections affect the activity section only. Summary/category/source totals use the common non-status base filters. Excluded and unposted audit rows do not contribute to posted totals.",
        ],
        [
          "Money precision",
          "PHP is rendered from exact DECIMAL strings; no frontend money accumulation.",
        ],
        ["Reconciliation", JSON.stringify(report.reconciliation)],
        [
          "Limitations",
          "Recorded income is not confirmed cash collected; expenses are not confirmed cash disbursed. Net operating result is not available cash. Operational report, not an audited financial statement.",
        ],
      ],
      sections,
    };
    return format === "pdf"
      ? await renderReportPdf(document)
      : await renderReportXlsx(document);
  });
}
