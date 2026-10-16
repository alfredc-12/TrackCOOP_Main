import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listShareCapitalQuerySchema,
  completeDividendActionSchema,
  createDividendDeclarationSchema,
  dividendDeclarationPreviewSchema,
  dividendFinancialBasisQuerySchema,
  shareCapitalAccountsQuerySchema,
  shareCapitalLedgerQuerySchema,
  memberShareCapitalTransactionsQuerySchema,
  requestDividendWithdrawalSchema,
  shareCapitalSchema,
  updateShareCapitalSchema,
} from "./share-capital.schema";
import type { ShareCapitalService } from "./share-capital.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function validationError(error: ZodError) {
  return new AppError(
    "The request payload is invalid",
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

export function createShareCapitalController(service: ShareCapitalService) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listShareCapitalQuerySchema, request.query);
      const result = await service.listPayments(query);
      return sendSuccess(response, result.payments, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.summary());
    }),
    listAccounts: asyncHandler(async (request, response) => {
      const query = parseBody(shareCapitalAccountsQuerySchema, request.query);
      const result = await service.listAccounts(query);
      return sendSuccess(response, result.accounts, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    listLedgerTransactions: asyncHandler(async (request, response) => {
      const query = parseBody(shareCapitalLedgerQuerySchema, request.query);
      const result = await service.listLedgerTransactions(query);
      return sendSuccess(response, result.transactions, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    memberProgress: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.memberProgress(requireParam(request.params.memberId, "memberId")),
      );
    }),
    create: asyncHandler(async (request, response) => {
      const input = parseBody(shareCapitalSchema, request.body);
      const payment = await service.createPayment(input, requireAuth(request.auth));
      return sendSuccess(response, payment, { statusCode: 201, message: "Share capital payment created" });
    }),
    detail: asyncHandler(async (request, response) => {
      const payment = await service.getPayment(requireParam(request.params.id, "id"));
      if (!payment) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
      return sendSuccess(response, payment);
    }),
    update: asyncHandler(async (request, response) => {
      const input = parseBody(updateShareCapitalSchema, request.body);
      const payment = await service.updatePayment(
        requireParam(request.params.id, "id"),
        input,
        requireAuth(request.auth),
      );
      return sendSuccess(response, payment, { message: "Share capital payment updated" });
    }),
    memberOverview: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.memberOverview(requireAuth(request.auth).user.id),
      );
    }),
    memberTransactions: asyncHandler(async (request, response) => {
      const query = parseBody(memberShareCapitalTransactionsQuerySchema, request.query);
      const result = await service.memberTransactions(
        requireAuth(request.auth).user.id,
        query,
      );
      return sendSuccess(response, result.transactions, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    memberGrowth: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.memberGrowth(requireAuth(request.auth).user.id),
      );
    }),
    memberDividends: asyncHandler(async (request, response) => {
      return sendSuccess(response, await service.memberDividends(requireAuth(request.auth).user.id));
    }),
    requestDividendCapitalization: asyncHandler(async (request, response) => {
      const result = await service.requestDividendCapitalization(
        requireAuth(request.auth).user.id,
        requireParam(request.params.id, "id"),
      );
      return sendSuccess(response, result, { message: "Share Capital addition requested" });
    }),
    requestDividendWithdrawal: asyncHandler(async (request, response) => {
      const input = parseBody(requestDividendWithdrawalSchema, request.body);
      const result = await service.requestDividendWithdrawal(
        requireAuth(request.auth).user.id,
        requireParam(request.params.id, "id"),
        input,
      );
      return sendSuccess(response, result, { message: "Dividend withdrawal requested" });
    }),
    dividendFinancialBasis: asyncHandler(async (request, response) => {
      const input = parseBody(dividendFinancialBasisQuerySchema, request.query);
      return sendSuccess(response, await service.dividendFinancialBasis(input.coverageStart, input.coverageEnd));
    }),
    previewDividendDeclaration: asyncHandler(async (request, response) => {
      const input = parseBody(dividendDeclarationPreviewSchema, request.body);
      return sendSuccess(response, await service.previewDividendDeclaration(input));
    }),
    listDividendDeclarations: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.listDividendDeclarations());
    }),
    listDividendDeclarationMembers: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.listDividendDeclarationMembers(requireParam(request.params.id, "id")),
      );
    }),
    createDividendDeclaration: asyncHandler(async (request, response) => {
      const input = parseBody(createDividendDeclarationSchema, request.body);
      const result = await service.createDividendDeclaration(input, requireAuth(request.auth));
      return sendSuccess(response, result, { statusCode: 201, message: "Dividend declaration created" });
    }),
    approveDividendDeclaration: asyncHandler(async (request, response) => {
      const result = await service.approveDividendDeclaration(
        requireParam(request.params.id, "id"),
        requireAuth(request.auth),
      );
      return sendSuccess(response, result, { message: "Dividend declaration approved" });
    }),
    rejectDividendDeclaration: asyncHandler(async (request, response) => {
      const result = await service.rejectDividendDeclaration(
        requireParam(request.params.id, "id"),
        requireAuth(request.auth),
      );
      return sendSuccess(response, result, { message: "Dividend declaration rejected" });
    }),
    publishDividendDeclaration: asyncHandler(async (request, response) => {
      const result = await service.publishDividendDeclaration(
        requireParam(request.params.id, "id"),
        requireAuth(request.auth),
      );
      return sendSuccess(response, result, { message: "Dividend declaration published" });
    }),
    listDividendWithdrawalRequests: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.listDividendActionRequests());
    }),
    listDividendActionHistory: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.listDividendActionHistory());
    }),
    completeDividendWithdrawal: asyncHandler(async (request, response) => {
      const input = parseBody(completeDividendActionSchema, request.body);
      const result = await service.completeDividendAction(
        requireParam(request.params.id, "id"),
        input,
        requireAuth(request.auth),
      );
      return sendSuccess(response, result, { message: "Dividend action completed" });
    }),
  };
}
