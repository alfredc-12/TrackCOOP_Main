import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createShareCapitalRepository,
  MAX_SHARE_CAPITAL,
  type ShareCapitalRepository,
} from "./share-capital.repository";
import type {
  DividendCompletionInput,
  DividendWithdrawalInput,
  MemberShareCapitalTransactionsQuery,
  ShareCapitalAccountListQuery,
  ShareCapitalInput,
  ShareCapitalLedgerListQuery,
  ShareCapitalListQuery,
  UpdateShareCapitalInput,
} from "./share-capital.types";
import {
  createShareCapitalLedgerRepository,
  type ShareCapitalLedgerRepository,
} from "./share-capital-ledger.repository";

export interface ShareCapitalService {
  listPayments(query: ShareCapitalListQuery): ReturnType<ShareCapitalRepository["list"]>;
  getPayment(id: string): ReturnType<ShareCapitalRepository["findById"]>;
  createPayment(input: ShareCapitalInput, auth: AuthContext): ReturnType<ShareCapitalRepository["create"]>;
  updatePayment(id: string, input: UpdateShareCapitalInput, auth: AuthContext): ReturnType<ShareCapitalRepository["update"]>;
  memberProgress(memberId: string): ReturnType<ShareCapitalRepository["memberProgress"]>;
  summary(): ReturnType<ShareCapitalRepository["summary"]>;
  listAccounts(query: ShareCapitalAccountListQuery): ReturnType<ShareCapitalLedgerRepository["listAccounts"]>;
  listLedgerTransactions(query: ShareCapitalLedgerListQuery): ReturnType<ShareCapitalLedgerRepository["listLedgerTransactions"]>;
  memberOverview(userId: string): ReturnType<ShareCapitalLedgerRepository["memberOverview"]>;
  memberTransactions(userId: string, query: MemberShareCapitalTransactionsQuery): ReturnType<ShareCapitalLedgerRepository["memberTransactions"]>;
  memberGrowth(userId: string): ReturnType<ShareCapitalLedgerRepository["memberGrowth"]>;
  memberDividends(userId: string): ReturnType<ShareCapitalLedgerRepository["memberDividends"]>;
  addDividendToShareCapital(userId: string, dividendId: string): ReturnType<ShareCapitalLedgerRepository["addDividendToShareCapital"]>;
  requestDividendWithdrawal(userId: string, dividendId: string, input?: DividendWithdrawalInput): ReturnType<ShareCapitalLedgerRepository["requestDividendWithdrawal"]>;
  dividendFinancialBasis(coverageStart: string, coverageEnd: string): ReturnType<ShareCapitalLedgerRepository["dividendFinancialBasis"]>;
  previewDividendDeclaration(input: Parameters<ShareCapitalLedgerRepository["previewDividendDeclaration"]>[0]): ReturnType<ShareCapitalLedgerRepository["previewDividendDeclaration"]>;
  listDividendDeclarations(): ReturnType<ShareCapitalLedgerRepository["listDividendDeclarations"]>;
  listDividendDeclarationMembers(declarationId: string): ReturnType<ShareCapitalLedgerRepository["listDividendDeclarationMembers"]>;
  createDividendDeclaration(input: Parameters<ShareCapitalLedgerRepository["createDividendDeclaration"]>[0], auth: AuthContext): ReturnType<ShareCapitalLedgerRepository["createDividendDeclaration"]>;
  approveDividendDeclaration(declarationId: string, auth: AuthContext): ReturnType<ShareCapitalLedgerRepository["approveDividendDeclaration"]>;
  rejectDividendDeclaration(declarationId: string, auth: AuthContext): ReturnType<ShareCapitalLedgerRepository["rejectDividendDeclaration"]>;
  publishDividendDeclaration(declarationId: string, auth: AuthContext): ReturnType<ShareCapitalLedgerRepository["publishDividendDeclaration"]>;
  listDividendActionRequests(): ReturnType<ShareCapitalLedgerRepository["listDividendActionRequests"]>;
  listDividendActionHistory(): ReturnType<ShareCapitalLedgerRepository["listDividendActionHistory"]>;
  completeDividendAction(dividendId: string, input: DividendCompletionInput, auth: AuthContext): ReturnType<ShareCapitalLedgerRepository["completeDividendAction"]>;
}

export function createShareCapitalService(
  repository: ShareCapitalRepository = createShareCapitalRepository(),
  ledgerRepository: ShareCapitalLedgerRepository = createShareCapitalLedgerRepository(),
): ShareCapitalService {
  async function assertWithinCapitalLimit(
    memberId: string,
    amount: number,
    status: string | undefined,
    excludingPaymentId?: string,
  ) {
    if (status !== "Validated") return;
    const currentTotal = await repository.validatedTotal(memberId, excludingPaymentId);
    if (currentTotal + amount > MAX_SHARE_CAPITAL) {
      throw new AppError(
        "Validated share capital cannot exceed PHP 15,000",
        409,
        "SHARE_CAPITAL_LIMIT_EXCEEDED",
      );
    }
  }

  return {
    listPayments(query) {
      return repository.list(query);
    },
    getPayment(id) {
      return repository.findById(id);
    },
    async createPayment(input, auth) {
      await assertWithinCapitalLimit(input.memberId, input.amount, input.paymentStatus);
      return repository.create(input, auth);
    },
    async updatePayment(id, input, auth) {
      const existing = await repository.findById(id);
      if (!existing) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
      await assertWithinCapitalLimit(
        input.memberId ?? existing.memberId,
        input.amount ?? existing.amount,
        input.paymentStatus ?? existing.paymentStatus,
        id,
      );
      return repository.update(id, input, auth);
    },
    memberProgress(memberId) {
      return repository.memberProgress(memberId);
    },
    summary() {
      return repository.summary();
    },
    listAccounts(query) {
      return ledgerRepository.listAccounts(query);
    },
    listLedgerTransactions(query) {
      return ledgerRepository.listLedgerTransactions(query);
    },
    memberOverview(userId) {
      return ledgerRepository.memberOverview(userId);
    },
    memberTransactions(userId, query) {
      return ledgerRepository.memberTransactions(userId, query);
    },
    memberGrowth(userId) {
      return ledgerRepository.memberGrowth(userId);
    },
    memberDividends(userId) {
      return ledgerRepository.memberDividends(userId);
    },
    addDividendToShareCapital(userId, dividendId) {
      return ledgerRepository.addDividendToShareCapital(userId, dividendId);
    },
    requestDividendWithdrawal(userId, dividendId, input) {
      return ledgerRepository.requestDividendWithdrawal(userId, dividendId, input);
    },
    dividendFinancialBasis(coverageStart, coverageEnd) {
      return ledgerRepository.dividendFinancialBasis(coverageStart, coverageEnd);
    },
    previewDividendDeclaration(input) {
      return ledgerRepository.previewDividendDeclaration(input);
    },
    listDividendDeclarations() {
      return ledgerRepository.listDividendDeclarations();
    },
    listDividendDeclarationMembers(declarationId) {
      return ledgerRepository.listDividendDeclarationMembers(declarationId);
    },
    createDividendDeclaration(input, auth) {
      return ledgerRepository.createDividendDeclaration(input, auth.user.id);
    },
    approveDividendDeclaration(declarationId, auth) {
      return ledgerRepository.approveDividendDeclaration(declarationId, auth.user.id);
    },
    rejectDividendDeclaration(declarationId, auth) {
      return ledgerRepository.rejectDividendDeclaration(declarationId, auth.user.id);
    },
    publishDividendDeclaration(declarationId, auth) {
      return ledgerRepository.publishDividendDeclaration(declarationId, auth.user.id);
    },
    listDividendActionRequests() {
      return ledgerRepository.listDividendActionRequests();
    },
    listDividendActionHistory() {
      return ledgerRepository.listDividendActionHistory();
    },
    completeDividendAction(dividendId, input, auth) {
      return ledgerRepository.completeDividendAction(dividendId, input, auth.user.id);
    },
  };
}
