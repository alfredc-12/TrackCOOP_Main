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
