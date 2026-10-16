import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createShareCapitalController } from "./share-capital.controller";
import {
  createShareCapitalService,
  type ShareCapitalService,
} from "./share-capital.service";

export function createShareCapitalRouter(
  authService: AuthService = createAuthService(),
  shareCapitalService: ShareCapitalService = createShareCapitalService(),
) {
  const router = Router();
  const controller = createShareCapitalController(shareCapitalService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];
  const memberOnly = [createAuthenticate(authService), requireRoles("member")];
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/members/me/share-capital/overview", ...memberOnly, controller.memberOverview);
  router.get("/members/me/share-capital/transactions", ...memberOnly, controller.memberTransactions);
  router.get("/members/me/share-capital/growth", ...memberOnly, controller.memberGrowth);
  router.get("/members/me/dividends", ...memberOnly, controller.memberDividends);
  router.post("/members/me/dividends/:id/add-to-capital", ...memberOnly, controller.requestDividendCapitalization);
  router.post("/members/me/dividends/:id/request-withdrawal", ...memberOnly, controller.requestDividendWithdrawal);
  router.get("/dividends/declarations", ...staff, controller.listDividendDeclarations);
  router.get("/dividends/financial-basis", ...chairmanOnly, controller.dividendFinancialBasis);
  router.post("/dividends/declarations/preview", ...chairmanOnly, controller.previewDividendDeclaration);
  router.get("/dividends/declarations/:id/members", ...staff, controller.listDividendDeclarationMembers);
  router.post("/dividends/declarations", ...chairmanOnly, controller.createDividendDeclaration);
  router.post("/dividends/declarations/:id/approve", ...chairmanOnly, controller.approveDividendDeclaration);
  router.post("/dividends/declarations/:id/reject", ...chairmanOnly, controller.rejectDividendDeclaration);
  router.post("/dividends/declarations/:id/publish", ...chairmanOnly, controller.publishDividendDeclaration);
  router.get("/dividends/withdrawals", ...bookkeeperOnly, controller.listDividendWithdrawalRequests);
  router.get("/dividends/withdrawals/history", ...bookkeeperOnly, controller.listDividendActionHistory);
  router.post("/dividends/withdrawals/:id/complete", ...bookkeeperOnly, controller.completeDividendWithdrawal);
  router.get("/share-capital", ...staff, controller.list);
  router.post("/share-capital", ...staff, controller.create);
  router.get("/share-capital/summary", ...staff, controller.summary);
  router.get("/share-capital/accounts", ...staff, controller.listAccounts);
  router.get("/share-capital/transactions", ...staff, controller.listLedgerTransactions);
  router.get("/share-capital/member/:memberId", ...staff, controller.memberProgress);
  router.get("/share-capital/:id", ...staff, controller.detail);
  router.patch("/share-capital/:id", ...bookkeeperOnly, controller.update);

  return router;
}
