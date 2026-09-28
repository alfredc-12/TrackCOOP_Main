import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createFinanceService } from "./finance.service";
import type { FinanceRepository } from "./finance.repository";
import type { FinancialRecord } from "./finance.types";

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Book Keeper",
    email: "bookkeeper@example.test",
    username: "bookkeeper",
    role: "bookkeeper",
  },
};

const record: FinancialRecord = {
  id: "30",
  recordNumber: "FIN-001",
  paymentReferenceId: null,
  memberId: null,
  financialCategoryId: "1",
  categoryName: "Sales",
  recordedBy: "1",
  approvedBy: "1",
  recordType: "Income",
  sourceModule: "Manual",
  sourceRecordId: null,
  amount: 1000,
  recordDate: new Date("2026-07-18T00:00:00.000Z"),
  recordStatus: "Active",
  correctionOfRecordId: null,
  reversalOfRecordId: null,
  remarks: null,
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  updatedAt: new Date("2026-07-18T00:00:00.000Z"),
};

function createRepository(overrides: Partial<FinanceRepository> = {}): FinanceRepository {
  return {
    async listCategories() {
      return [];
    },
    async createCategory() {
      throw new Error("not used");
    },
    async updateCategory() {
      throw new Error("not used");
    },
    async listRecords() {
      return { records: [], total: 0, page: 1, pageSize: 20 };
    },
    async findRecordById() {
      return record;
    },
    async createRecord() {
      return record;
    },
    async updateRecord() {
      return record;
    },
    async postRecord() {
      return record;
    },
    async voidRecord() {
      return { ...record, recordStatus: "Voided" };
    },
    async createOperatingExpense() {
      return {
        id: "31",
        recordNumber: "FIN-OPEX-20260718-ABC12345",
        expenseType: "Fuel",
        categoryCode: "FUEL_GASOLINE",
        categoryName: "Fuel and Gasoline",
        amount: 500,
        expenseDate: "2026-07-18",
        remarks: "Operating expense: Fuel.",
        recordedBy: "1",
        approvedBy: "1",
        createdAt: new Date("2026-07-18T00:00:00.000Z"),
      };
    },
    async operatingExpenses() {
      return {
        items: [],
        byType: [],
        total: 0,
        count: 0,
        startDate: null,
        endDate: null,
      };
    },
    async summary() {
      throw new Error("not used");
    },
    async trends() {
      return [];
    },
    ...overrides,
  };
}

test("postRecord rejects an already posted record", async () => {
  const service = createFinanceService(createRepository());

  await assert.rejects(
    () => service.postRecord(record.id, auth),
    (error) =>
      error instanceof AppError && error.code === "FINANCIAL_RECORD_ALREADY_POSTED",
  );
});

test("postRecord delegates unposted active records", async () => {
  let delegated = false;
  const service = createFinanceService(
    createRepository({
      async findRecordById() {
        return { ...record, approvedBy: null };
      },
      async postRecord() {
        delegated = true;
        return { ...record, approvedBy: auth.user.id };
      },
    }),
  );

  const updated = await service.postRecord(record.id, auth);

  assert.equal(delegated, true);
  assert.equal(updated.approvedBy, auth.user.id);
});

test("createOperatingExpense delegates to repository", async () => {
  let delegated = false;
  const service = createFinanceService(
    createRepository({
      async createOperatingExpense(input) {
        delegated = true;
        return {
          id: "31",
          recordNumber: "FIN-OPEX-20260718-ABC12345",
          expenseType: input.expenseType,
          categoryCode: "FUEL_GASOLINE",
          categoryName: "Fuel and Gasoline",
          amount: input.amount,
          expenseDate: input.expenseDate,
          remarks: input.remarks ?? null,
          recordedBy: auth.user.id,
          approvedBy: auth.user.id,
          createdAt: new Date("2026-07-18T00:00:00.000Z"),
        };
      },
    }),
  );

  const created = await service.createOperatingExpense({
    expenseType: "Fuel",
    amount: 500,
    expenseDate: "2026-07-18",
    remarks: null,
  }, auth);

  assert.equal(delegated, true);
  assert.equal(created.amount, 500);
  assert.equal(created.approvedBy, auth.user.id);
});

test("operatingExpenseReport renders a PDF document", async () => {
  const service = createFinanceService(
    createRepository({
      async operatingExpenses() {
        return {
          items: [
            {
              id: "31",
              recordNumber: "FIN-OPEX-20260718-ABC12345",
              expenseType: "Other",
              categoryCode: "OTHER_EXPENSE",
              categoryName: "Other Expense",
              amount: 1250,
              expenseDate: "2026-07-18",
              remarks: "Operating expense: Other. Specific expense: Permit renewal.",
              recordedBy: auth.user.id,
              approvedBy: auth.user.id,
              createdAt: new Date("2026-07-18T00:00:00.000Z"),
            },
          ],
          byType: [
            { expenseType: "Salaries", total: 0, count: 0 },
            { expenseType: "Fuel", total: 0, count: 0 },
            { expenseType: "Electricity", total: 0, count: 0 },
            { expenseType: "Repairs", total: 0, count: 0 },
            { expenseType: "Office expenses", total: 0, count: 0 },
            { expenseType: "Insurance", total: 0, count: 0 },
            { expenseType: "Other", total: 1250, count: 1 },
          ],
          total: 1250,
          count: 1,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        };
      },
    }),
  );

  const pdf = await service.operatingExpenseReport({ startDate: "2026-01-01", endDate: "2026-12-31" }, auth);

  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
});
