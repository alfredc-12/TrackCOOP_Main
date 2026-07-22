import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createFinanceRepository,
  type FinanceRepository,
} from "./finance.repository";
import type {
  FinancialCategoryInput,
  FinancialRecordInput,
  FinancialRecordListQuery,
  UpdateFinancialCategoryInput,
  UpdateFinancialRecordInput,
} from "./finance.types";

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
    summary() {
      return repository.summary();
    },
    trends() {
      return repository.trends();
    },
  };
}
