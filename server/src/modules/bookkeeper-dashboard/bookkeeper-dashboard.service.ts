import type { Pool } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { formatCentavos, percentChange, sharePercent, toCentavos } from "./bookkeeper-dashboard.money";
import { resolveDashboardPeriod, type DashboardPeriod } from "./bookkeeper-dashboard.period";
import * as repository from "./bookkeeper-dashboard.repository";
import type { DashboardExecutor } from "./bookkeeper-dashboard.repository";
import type { DashboardQuery } from "./bookkeeper-dashboard.schema";
import type {
  AttentionItem,
  BookkeeperDashboard,
  DashboardSectionKey,
  ExpenseCategoryItem,
  IncomeSourceItem,
  RecentRecord,
  SourceKey,
} from "./bookkeeper-dashboard.types";

const sourceLabels: Record<SourceKey, string> = {
  pos: "Store (POS) sales",
  rental: "Equipment rentals",
  membership: "Membership fees",
  donations: "Donations & grants",
  other: "Other operating income",
};
const sourceOrder: SourceKey[] = ["pos", "rental", "membership", "donations", "other"];

const num = (value: unknown) => Number(value ?? 0);
const money = (value: unknown) => formatCentavos(toCentavos(value));

function classify(row: Record<string, unknown>): RecentRecord["classification"] {
  if (num(row.operating) === 1) return "operating";
  if (row.recordType === "Adjustment") return "adjustment";
  if (num(row.capital) === 1) return "capital";
  return "excluded";
}

function recordStatus(row: Record<string, unknown>): RecentRecord["status"] {
  const status = String(row.recordStatus);
  if (status === "Voided" || status === "Reversed" || status === "Corrected") return status;
  return num(row.posted) === 1 ? "Posted" : "Unposted";
}

export function createBookkeeperDashboardService(pool?: Pool, clock: () => Date = () => new Date()) {
  const database = () => pool ?? getPool();

  /** One REPEATABLE READ, read-only snapshot so every card and chart describes the same moment. */
  async function snapshot<T>(work: (db: DashboardExecutor) => Promise<T>) {
    const connection = await database().getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.query("START TRANSACTION READ ONLY");
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    async dashboard(query: Pick<DashboardQuery, "period" | "start" | "end">): Promise<BookkeeperDashboard> {
      const now = clock();
      const period = resolveDashboardPeriod(query, now);
      return snapshot((db) => buildDashboard(db, period, now));
    },
  };
}

export async function buildDashboard(db: DashboardExecutor, period: DashboardPeriod, now: Date): Promise<BookkeeperDashboard> {
  const errors: BookkeeperDashboard["errors"] = {};
  /** A failing section reports its own error without invalidating figures that were read successfully. */
  async function section<T>(key: DashboardSectionKey, work: () => Promise<T>): Promise<T | null> {
    try {
      return await work();
    } catch (error) {
      const code = (error as { code?: string }).code;
      errors[key] = code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR"
        ? "Required finance tables are unavailable."
        : "This section could not be loaded.";
      return null;
    }
  }
  const current = { start: period.start, end: period.end };
  const previous = { start: period.previousStart, end: period.previousEnd };

  const attention = await section("attention", async () => {
    const { counts, tests, items } = await repository.readAttention(db, period.today);
    return {
      basis: "current-backlog" as const,
      awaitingReview: num(counts.awaitingReview),
      awaitingGateway: num(counts.awaitingGateway),
      needsClarification: num(counts.needsClarification),
      approvedToday: num(counts.approvedToday),
      recordsNeedingAttention: num(counts.exceptions),
      testPaymentsExcluded: num(tests.total),
      items: items.map((row): AttentionItem => ({
        id: String(row.id),
        referenceNumber: String(row.referenceNumber),
        payer: row.payer === null ? null : String(row.payer),
        purpose: String(row.purpose),
        channel: String(row.channel),
        amount: money(row.amount),
        status: String(row.status),
        submittedAt: new Date(String(row.submittedAt)).toISOString(),
        reason: row.reason as AttentionItem["reason"],
      })),
    };
  });

  const overview = await section("overview", async () => {
    const [now_, before, adjustments] = await Promise.all([
      repository.readOperatingTotals(db, current),
      repository.readOperatingTotals(db, previous),
      repository.readAdjustments(db, current),
    ]);
    const income = toCentavos(now_.income);
    const expenses = toCentavos(now_.expenses);
    const net = income - expenses;
    const previousIncome = toCentavos(before.income);
    const previousExpenses = toCentavos(before.expenses);
    const previousNet = previousIncome - previousExpenses;
    return {
      income: formatCentavos(income),
      expenses: formatCentavos(expenses),
      net: formatCentavos(net),
      incomeCount: num(now_.incomeCount),
      expenseCount: num(now_.expenseCount),
      previous: {
        income: formatCentavos(previousIncome),
        expenses: formatCentavos(previousExpenses),
        net: formatCentavos(previousNet),
        start: period.previousStart,
        end: period.previousEnd,
        label: period.previousLabel,
      },
      change: percentChange(net, previousNet),
      adjustments: {
        total: money(adjustments.total),
        count: num(adjustments.count),
        reversalTotal: money(adjustments.reversalTotal),
        reversalCount: num(adjustments.reversalCount),
      },
    };
  });

  const trend = await section("trend", async () => {
    const rows = await repository.readTrend(db, { start: period.trendStart, end: period.trendEnd });
    const byMonth = new Map(rows.map((row) => [String(row.month), row]));
    return period.trendMonths.map((first) => {
      const month = first.slice(0, 7);
      const row = byMonth.get(month);
      const income = toCentavos(row?.income);
      const expenses = toCentavos(row?.expenses);
      return { month, income: formatCentavos(income), expenses: formatCentavos(expenses), net: formatCentavos(income - expenses) };
    });
  });

  const incomeBySource = await section("incomeBySource", async () => {
    const rows = await repository.readIncomeBySource(db, current);
    const totals = new Map(rows.map((row) => [String(row.source) as SourceKey, row]));
    const total = rows.reduce((sum, row) => sum + toCentavos(row.amount), 0);
    const items = sourceOrder
      .map((key): IncomeSourceItem => {
        const row = totals.get(key);
        const amount = toCentavos(row?.amount);
        return { key, label: sourceLabels[key], amount: formatCentavos(amount), count: num(row?.count), sharePercent: sharePercent(amount, total) };
      })
      .sort((a, b) => toCentavos(b.amount) - toCentavos(a.amount));
    return { total: formatCentavos(total), items };
  });

  const memberCapitalReceived = await section("memberCapitalReceived", async () => {
    const row = await repository.readCapitalReceived(db, current);
    const gross = toCentavos(row.gross);
    const reversals = toCentavos(row.reversals);
    return { net: formatCentavos(gross - reversals), gross: formatCentavos(gross), reversals: formatCentavos(reversals), count: num(row.count) };
  });

  const expenseByCategory = await section("expenseByCategory", async () => {
    const [rows, before] = await Promise.all([
      repository.readExpensesByCategory(db, current),
      repository.readExpensesByCategory(db, previous),
    ]);
    const previousById = new Map(before.map((row) => [String(row.id), toCentavos(row.amount)]));
    const total = rows.reduce((sum, row) => sum + toCentavos(row.amount), 0);
    const items = rows.map((row): ExpenseCategoryItem => {
      const amount = toCentavos(row.amount);
      const prior = previousById.get(String(row.id)) ?? 0;
      return {
        id: String(row.id),
        name: String(row.name),
        amount: formatCentavos(amount),
        count: num(row.count),
        sharePercent: sharePercent(amount, total),
        previousAmount: formatCentavos(prior),
        change: percentChange(amount, prior),
      };
    });
    return { total: formatCentavos(total), items };
  });

  const member = await section("member", async () => {
    const [balance, patronage, interest] = await Promise.all([
      repository.readCapitalBalance(db),
      repository.readPatronageOutstanding(db),
      repository.readInterestAwaitingAction(db),
    ]);
    return {
      capitalBalance: money(balance.balance),
      capitalHolders: num(balance.holders),
      patronageOutstanding: money(patronage.outstanding),
      patronageAllocations: num(patronage.allocations),
      interestAwaitingAction: {
        withdrawalCount: num(interest.withdrawalCount),
        withdrawalAmount: money(interest.withdrawalAmount),
        capitalizationCount: num(interest.capitalizationCount),
        capitalizationAmount: money(interest.capitalizationAmount),
      },
    };
  });

  const recent = await section("recent", async () => {
    const rows = await repository.readRecentRecords(db, current);
    return rows.map((row): RecentRecord => ({
      id: String(row.id),
      recordNumber: String(row.recordNumber),
      date: String(row.date),
      source: String(row.source),
      category: String(row.category),
      recordType: row.recordType as RecentRecord["recordType"],
      amount: money(row.amount),
      status: recordStatus(row),
      classification: classify(row),
      paymentReferenceId: row.paymentReferenceId === null ? null : String(row.paymentReferenceId),
    }));
  });

  return {
    scope: {
      period: period.key,
      label: period.label,
      start: period.start,
      end: period.end,
      previousStart: period.previousStart,
      previousEnd: period.previousEnd,
      previousLabel: period.previousLabel,
      today: period.today,
      timezone: "Asia/Manila",
    },
    generatedAt: now.toISOString(),
    attention,
    overview,
    trend,
    incomeBySource,
    memberCapitalReceived,
    expenseByCategory,
    member,
    recent,
    errors,
  };
}

export type BookkeeperDashboardService = ReturnType<typeof createBookkeeperDashboardService>;

