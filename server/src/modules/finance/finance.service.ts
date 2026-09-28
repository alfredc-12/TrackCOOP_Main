import { AppError } from "../../utils/app-error";
import PDFDocument from "pdfkit";
import type { AuthContext } from "../auth/auth.types";
import {
  createFinanceRepository,
  type FinanceRepository,
} from "./finance.repository";
import type {
  FinancialCategoryInput,
  FinancialRecordInput,
  FinancialRecordListQuery,
  OperatingExpenseInput,
  OperatingExpenseListQuery,
  OperatingExpenseSummary,
  UpdateFinancialCategoryInput,
  UpdateFinancialRecordInput,
} from "./finance.types";

function peso(value: number) {
  return `PHP ${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function renderOperatingExpenseReport(summary: OperatingExpenseSummary, auth: AuthContext) {
  const document = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const generatedAt = new Date();
  const periodLabel = summary.startDate || summary.endDate
    ? `${summary.startDate ?? "Beginning"} to ${summary.endDate ?? "Present"}`
    : "All recorded dates";
  const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const left = document.page.margins.left;
  const bottomLimit = document.page.height - document.page.margins.bottom - 32;

  const ensureSpace = (height: number) => {
    if (document.y + height > bottomLimit) document.addPage();
  };

  const sectionTitle = (title: string) => {
    ensureSpace(36);
    document.moveDown(0.8);
    document.fontSize(11).fillColor("#123D2A").text(title, left, document.y, {
      width: pageWidth,
    });
    document.moveDown(0.35);
  };

  const drawSummaryHeader = () => {
    const y = document.y;
    document.rect(left, y, pageWidth, 24).fill("#E7F2E4");
    document.fillColor("#123D2A").fontSize(8).font("Helvetica-Bold");
    document.text("Expense Type", left + 8, y + 8, { width: 210 });
    document.text("Records", left + 260, y + 8, { width: 70, align: "right" });
    document.text("Total", left + 360, y + 8, { width: 140, align: "right" });
    document.font("Helvetica");
    document.y = y + 28;
  };

  const drawRecordHeader = () => {
    const y = document.y;
    document.rect(left, y, pageWidth, 24).fill("#E7F2E4");
    document.fillColor("#123D2A").fontSize(7.5).font("Helvetica-Bold");
    document.text("Date", left + 8, y + 8, { width: 70 });
    document.text("Record No.", left + 86, y + 8, { width: 112 });
    document.text("Expense", left + 206, y + 8, { width: 105 });
    document.text("Notes", left + 318, y + 8, { width: 105 });
    document.text("Amount", left + 432, y + 8, { width: 78, align: "right" });
    document.font("Helvetica");
    document.y = y + 28;
  };

  document.rect(0, 0, document.page.width, 74).fill("#123D2A");
  document.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text("Nasugbu Farmers and Fisherfolks Agriculture Cooperative", left, 24, { width: pageWidth });
  document.fillColor("#DDEBDD").fontSize(8).font("Helvetica").text("TrackCOOP Finance Office", left, 39, { width: pageWidth });
  document.fillColor("#D8A011").fontSize(8).font("Helvetica-Bold").text("SYSTEM-GENERATED OPERATING EXPENSE DOCUMENT", left, 54, { width: pageWidth });
  document.y = 96;

  document.fillColor("#123D2A").fontSize(20).font("Helvetica-Bold").text("Operating Expenses Summary", left, document.y, { width: pageWidth });
  document.moveDown(0.35);
  document.fillColor("#4A574F").fontSize(9).font("Helvetica").text(`Coverage: ${periodLabel}`);
  document.text(`Generated: ${generatedAt.toLocaleString("en-PH")} by ${auth.user.displayName}`);
  document.moveDown(0.9);

  const summaryBoxY = document.y;
  document.roundedRect(left, summaryBoxY, pageWidth, 62, 6).fillAndStroke("#F7F8F3", "#CAD8CB");
  document.fillColor("#5D6D63").fontSize(8).font("Helvetica-Bold").text("TOTAL OPERATING EXPENSES", left + 14, summaryBoxY + 13, { width: 220 });
  document.fillColor("#123D2A").fontSize(18).text(peso(summary.total), left + 14, summaryBoxY + 29, { width: 220 });
  document.fillColor("#5D6D63").fontSize(8).text("POSTED RECORDS", left + 285, summaryBoxY + 13, { width: 100, align: "right" });
  document.fillColor("#123D2A").fontSize(18).text(String(summary.count), left + 285, summaryBoxY + 29, { width: 100, align: "right" });
  document.fillColor("#5D6D63").fontSize(7.5).font("Helvetica").text("Included in patronage basis when the expense date falls within the patronage period.", left + 400, summaryBoxY + 16, { width: 96, align: "right" });
  document.y = summaryBoxY + 78;

  sectionTitle("Expense Totals by Type");
  drawSummaryHeader();
  for (const item of summary.byType) {
    ensureSpace(24);
    const y = document.y;
    document.fillColor("#17211C").fontSize(8.5);
    document.text(item.expenseType, left + 8, y + 4, { width: 210 });
    document.text(String(item.count), left + 260, y + 4, { width: 70, align: "right" });
    document.text(peso(item.total), left + 360, y + 4, { width: 140, align: "right" });
    document.moveTo(left, y + 22).lineTo(left + pageWidth, y + 22).strokeColor("#D9E1DC").stroke();
    document.y = y + 26;
  }

  sectionTitle("Recent Posted Expense Records");
  drawRecordHeader();
  for (const item of summary.items) {
    if (document.y + 36 > bottomLimit) {
      document.addPage();
      drawRecordHeader();
    }
    const y = document.y;
    const note = item.remarks ?? item.categoryName;
    document.fillColor("#17211C").fontSize(7.5);
    document.text(shortDate(item.expenseDate), left + 8, y + 3, { width: 70 });
    document.text(item.recordNumber, left + 86, y + 3, { width: 112, ellipsis: true });
    document.text(item.expenseType, left + 206, y + 3, { width: 105, ellipsis: true });
    document.fillColor("#52675A").text(note, left + 318, y + 3, { width: 105, height: 22, ellipsis: true });
    document.fillColor("#17211C").text(peso(item.amount), left + 432, y + 3, { width: 78, align: "right" });
    document.moveTo(left, y + 31).lineTo(left + pageWidth, y + 31).strokeColor("#D9E1DC").stroke();
    document.y = y + 35;
  }
  if (summary.items.length === 0) {
    document.fillColor("#5D6D63").fontSize(9).text("No operating expenses matched the selected period.", left, document.y, { width: pageWidth });
  }

  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    document.moveTo(left, document.page.height - 36).lineTo(left + pageWidth, document.page.height - 36).strokeColor("#D9E1DC").stroke();
    document.fontSize(7).fillColor("#6C7A70").text(
      `Page ${index - pages.start + 1} of ${pages.count} | Operating Expenses | TrackCOOP system-generated document`,
      document.page.margins.left,
      document.page.height - 28,
      {
        width: document.page.width - document.page.margins.left - document.page.margins.right,
        align: "center",
        lineBreak: false,
      },
    );
  }

  document.end();
  return completed;
}

export interface FinanceService {
  listCategories(): ReturnType<FinanceRepository["listCategories"]>;
  createCategory(input: FinancialCategoryInput, auth: AuthContext): ReturnType<FinanceRepository["createCategory"]>;
  updateCategory(id: string, input: UpdateFinancialCategoryInput, auth: AuthContext): ReturnType<FinanceRepository["updateCategory"]>;
  listRecords(query: FinancialRecordListQuery): ReturnType<FinanceRepository["listRecords"]>;
  getRecord(id: string): ReturnType<FinanceRepository["findRecordById"]>;
  createRecord(input: FinancialRecordInput, auth: AuthContext): ReturnType<FinanceRepository["createRecord"]>;
  updateRecord(id: string, input: UpdateFinancialRecordInput, auth: AuthContext): ReturnType<FinanceRepository["updateRecord"]>;
  postRecord(id: string, auth: AuthContext): ReturnType<FinanceRepository["postRecord"]>;
  voidRecord(id: string, reason: string | null | undefined, auth: AuthContext): ReturnType<FinanceRepository["voidRecord"]>;
  createOperatingExpense(input: OperatingExpenseInput, auth: AuthContext): ReturnType<FinanceRepository["createOperatingExpense"]>;
  operatingExpenses(query: OperatingExpenseListQuery): ReturnType<FinanceRepository["operatingExpenses"]>;
  operatingExpenseReport(query: OperatingExpenseListQuery, auth: AuthContext): Promise<Buffer>;
  summary(): ReturnType<FinanceRepository["summary"]>;
  trends(): ReturnType<FinanceRepository["trends"]>;
}

export function createFinanceService(
  repository: FinanceRepository = createFinanceRepository(),
): FinanceService {
  return {
    listCategories() {
      return repository.listCategories();
    },
    createCategory(input, auth) {
      return repository.createCategory(input, auth);
    },
    updateCategory(id, input, auth) {
      return repository.updateCategory(id, input, auth);
    },
    listRecords(query) {
      return repository.listRecords(query);
    },
    getRecord(id) {
      return repository.findRecordById(id);
    },
    createRecord(input, auth) {
      return repository.createRecord(input, auth);
    },
    updateRecord(id, input, auth) {
      return repository.updateRecord(id, input, auth);
    },
    async postRecord(id, auth) {
      const record = await repository.findRecordById(id);
      if (!record) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
      if (record.approvedBy) {
        throw new AppError("Financial record has already been posted", 409, "FINANCIAL_RECORD_ALREADY_POSTED");
      }
      return repository.postRecord(id, auth);
    },
    voidRecord(id, reason, auth) {
      return repository.voidRecord(id, reason, auth);
    },
    createOperatingExpense(input, auth) {
      return repository.createOperatingExpense(input, auth);
    },
    operatingExpenses(query) {
      return repository.operatingExpenses(query);
    },
    async operatingExpenseReport(query, auth) {
      return renderOperatingExpenseReport(await repository.operatingExpenses(query), auth);
    },
    summary() {
      return repository.summary();
    },
    trends() {
      return repository.trends();
    },
  };
}
