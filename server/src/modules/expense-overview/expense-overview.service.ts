import { AppError } from "../../utils/app-error";
import { expenseClassLabels, type ExpenseClass } from "./expense-classification";
import { fromCents, percentChange, percentOf, toCents } from "./expense-money";
import {
  bucketKey,
  buildBuckets,
  chooseGranularity,
  manilaToday,
  resolveComparison,
  resolvePeriod,
  type Granularity,
} from "./expense-periods";
import type { ExpenseFilters, ExpenseRecordQuery } from "./expense-overview.schema";
import { createExpenseOverviewRepository, type ExpenseOverviewRepository } from "./expense-overview.repository";
import type {
  CategoryTotal,
  DriverItem,
  ExpenseBudgetContext,
  ExpenseCategories,
  ExpenseDrivers,
  ExpenseInsight,
  ExpenseIntegrity,
  ExpenseMatrix,
  ExpensePeriodInfo,
  ExpenseRange,
  ExpenseRecordsPage,
  ExpenseSources,
  ExpenseSummary,
  ExpenseTrend,
  MatrixCell,
  TrendBucket,
} from "./expense-overview.types";

const maxBuckets = 400;

export function formatPeso(value: number) {
  return `PHP ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

export type ExpensePlan = {
  today: string;
  period: ReturnType<typeof resolvePeriod>;
  /** The elapsed part of the selected period. Null when the period has not started. */
  effective: ExpenseRange | null;
  previous: ExpenseRange | null;
  info: ExpensePeriodInfo;
};

export interface ExpenseOverviewService {
  plan(filters: ExpenseFilters): ExpensePlan;
  summary(filters: ExpenseFilters): Promise<ExpenseSummary>;
  trends(filters: ExpenseFilters): Promise<ExpenseTrend>;
  categories(filters: ExpenseFilters): Promise<ExpenseCategories>;
  sources(filters: ExpenseFilters): Promise<ExpenseSources>;
  drivers(filters: ExpenseFilters): Promise<ExpenseDrivers>;
  matrix(filters: ExpenseFilters): Promise<ExpenseMatrix>;
  records(query: ExpenseRecordQuery): Promise<ExpenseRecordsPage>;
  recordDetail(id: string): ReturnType<ExpenseOverviewRepository["recordDetail"]>;
  integrity(filters: ExpenseFilters): Promise<ExpenseIntegrity>;
  budget(filters: ExpenseFilters): Promise<ExpenseBudgetContext>;
  insights(filters: ExpenseFilters): Promise<ExpenseInsight[]>;
  options(): ReturnType<ExpenseOverviewRepository["filterOptions"]>;
  repository: ExpenseOverviewRepository;
}

function sumCents(values: number[]) {
  return values.reduce((sum, value) => sum + toCents(value), 0);
}

export function createExpenseOverviewService(
  repository: ExpenseOverviewRepository = createExpenseOverviewRepository(),
  clock: () => Date = () => new Date(),
): ExpenseOverviewService {
  function plan(filters: ExpenseFilters): ExpensePlan {
    const today = manilaToday(clock());
    const period = resolvePeriod(filters, today);
    const comparison = resolveComparison(period, filters.compare, today);
    const notStarted = Boolean(period.startDate && period.startDate > today);
    const effective: ExpenseRange | null = notStarted
      ? null
      : { startDate: period.startDate, endDate: period.endDate && period.endDate < today ? period.endDate : today };
    const previous: ExpenseRange | null = comparison.previous
      ? { startDate: comparison.previous.startDate, endDate: comparison.previous.endDate }
      : null;
    const periodDays = period.startDate && period.endDate ? comparison.current?.periodDays ?? null : null;
    return {
      today,
      period,
      effective,
      previous,
      info: {
        preset: period.preset,
        label: period.label,
        today,
        selected: { startDate: period.startDate, endDate: period.endDate },
        effective: {
          startDate: effective?.startDate ?? period.startDate,
          endDate: effective?.endDate ?? today,
          days: comparison.current?.days ?? null,
          periodDays,
          partial: Boolean(comparison.current?.partial),
        },
        compare: filters.compare,
        previous: comparison.previous,
        comparisonNote: comparison.unavailableReason,
      },
    };
  }

  const emptyTotals = { records: 0, amount: 0 };

  async function categoryList(filters: ExpenseFilters, p: ExpensePlan): Promise<CategoryTotal[]> {
    if (!p.effective) return [];
    const [current, previous] = await Promise.all([
      repository.categoryTotals(filters, p.effective),
      p.previous ? repository.categoryTotals(filters, p.previous) : Promise.resolve(null),
    ]);
    const total = sumCents(current.map((item) => item.amount));
    const before = new Map((previous ?? []).map((item) => [item.categoryId, item.amount]));
    // A category can appear twice if rows split across classes; merge by id so shares add up.
    const merged = new Map<string, CategoryTotal>();
    for (const item of current) {
      const existing = merged.get(item.categoryId);
      if (existing) {
        existing.amount = fromCents(toCents(existing.amount) + toCents(item.amount));
        existing.records += item.records;
        continue;
      }
      merged.set(item.categoryId, { ...item, share: null, previousAmount: previous ? before.get(item.categoryId) ?? 0 : null });
    }
    return [...merged.values()]
      .map((item) => ({ ...item, share: percentOf(toCents(item.amount), total) }))
      .sort((a, b) => toCents(b.amount) - toCents(a.amount) || a.name.localeCompare(b.name));
  }

  async function summary(filters: ExpenseFilters): Promise<ExpenseSummary> {
    const p = plan(filters);
    const capabilities = await repository.capabilities();
    const limitations = [
      "Amounts are posted expense records from the ledger. The ledger does not record when or how an expense was paid, so this is not a cash-outflow figure.",
    ];
    if (p.info.effective.partial) {
      limitations.push(`${p.period.label} is still in progress; figures cover ${p.info.effective.startDate} to ${p.today}, and the comparison uses the same number of elapsed days.`);
    }
    if (!p.effective) {
      limitations.push("The selected period has not started yet, so there is nothing to report.");
      return {
        period: p.info,
        capabilities,
        totals: { ...emptyTotals, averageAmount: null },
        previousTotals: null,
        change: { amount: null, percent: null, basis: "no_comparison" },
        largestCategory: null,
        secondary: { unposted: emptyTotals, voided: emptyTotals, correctedOrReversed: emptyTotals, needsClassification: emptyTotals },
        reconciliation: { selectedClasses: filters.classes, classTotals: [], recognizedExpenseTotal: 0, analyticsComparableTotal: 0, nonExpenseDisbursementTotal: 0, reconciles: true },
        limitations,
      };
    }
    const [current, previous, categories, secondary, classTotals, comparable] = await Promise.all([
      repository.totals(filters, p.effective),
      p.previous ? repository.totals(filters, p.previous) : Promise.resolve(null),
      categoryList(filters, { ...p, previous: null }),
      repository.statusTotals(filters, p.effective),
      repository.classTotals(filters, p.effective),
      repository.analyticsComparable(filters, p.effective),
    ]);
    const currentCents = toCents(current.amount);
    const previousCents = previous ? toCents(previous.amount) : null;
    const top = categories[0] ?? null;
    const recognized = sumCents(classTotals.filter((item) => item.expenseClass !== "non_expense_disbursement").map((item) => item.amount));
    const nonExpense = sumCents(classTotals.filter((item) => item.expenseClass === "non_expense_disbursement").map((item) => item.amount));
    return {
      period: p.info,
      capabilities,
      totals: {
        amount: current.amount,
        records: current.records,
        averageAmount: current.records > 0 ? fromCents(Math.round(currentCents / current.records)) : null,
      },
      previousTotals: previous,
      change: previousCents === null
        ? { amount: null, percent: null, basis: "no_comparison" }
        : {
            amount: fromCents(currentCents - previousCents),
            percent: percentChange(currentCents, previousCents),
            basis: previousCents > 0 ? "ok" : "no_previous_base",
          },
      largestCategory: top ? { categoryId: top.categoryId, name: top.name, amount: top.amount, records: top.records, share: top.share } : null,
      secondary,
      reconciliation: {
        selectedClasses: filters.classes,
        classTotals,
        recognizedExpenseTotal: fromCents(recognized),
        analyticsComparableTotal: comparable.amount,
        nonExpenseDisbursementTotal: fromCents(nonExpense),
        reconciles: recognized === toCents(comparable.amount),
      },
      limitations,
    };
  }

  async function trends(filters: ExpenseFilters): Promise<ExpenseTrend> {
    const p = plan(filters);
    if (!p.effective) return { granularity: filters.granularity ?? "month", buckets: [], total: 0, records: 0, previousTotal: null };
    let startDate = p.effective.startDate;
    if (!startDate) {
      startDate = await repository.earliestDate(filters);
      if (!startDate) return { granularity: filters.granularity ?? "month", buckets: [], total: 0, records: 0, previousTotal: null };
    }
    const range = { startDate, endDate: p.effective.endDate };
    const granularity: Granularity = filters.granularity ?? chooseGranularity(range);
    const buckets = buildBuckets(range, granularity);
    if (buckets.length > maxBuckets) {
      throw new AppError("That range has too many intervals for this granularity; choose a coarser one", 400, "TOO_MANY_BUCKETS");
    }
    const rows = await repository.dailyTotals(filters, p.effective);
    const slots = new Map<string, { cents: number; records: number; byCategory: Map<string, { name: string; cents: number }> }>();
    for (const bucket of buckets) slots.set(bucket.key, { cents: 0, records: 0, byCategory: new Map() });
    for (const row of rows) {
      const slot = slots.get(bucketKey(row.date, granularity));
      if (!slot) continue;
      slot.cents += toCents(row.amount);
      slot.records += row.records;
      const category = slot.byCategory.get(row.categoryId) ?? { name: row.name, cents: 0 };
      category.cents += toCents(row.amount);
      slot.byCategory.set(row.categoryId, category);
    }
    let previousBuckets: ReturnType<typeof buildBuckets> = [];
    const previousSlots = new Map<string, { cents: number; records: number }>();
    if (p.previous) {
      previousBuckets = buildBuckets({ startDate: p.previous.startDate ?? range.startDate, endDate: p.previous.endDate }, granularity);
      for (const bucket of previousBuckets) previousSlots.set(bucket.key, { cents: 0, records: 0 });
      for (const row of await repository.dailyTotals(filters, p.previous)) {
        const slot = previousSlots.get(bucketKey(row.date, granularity));
        if (!slot) continue;
        slot.cents += toCents(row.amount);
        slot.records += row.records;
      }
    }
    const result: TrendBucket[] = buckets.map((bucket, index) => {
      const slot = slots.get(bucket.key)!;
      const top = [...slot.byCategory.values()].sort((a, b) => b.cents - a.cents)[0];
      const pair = previousBuckets[index];
      const pairSlot = pair ? previousSlots.get(pair.key) : undefined;
      return {
        ...bucket,
        amount: fromCents(slot.cents),
        records: slot.records,
        topCategory: top ? { name: top.name, amount: fromCents(top.cents) } : null,
        previous: pair && pairSlot ? { label: pair.label, amount: fromCents(pairSlot.cents), records: pairSlot.records } : null,
      };
    });
    return {
      granularity,
      buckets: result,
      total: fromCents([...slots.values()].reduce((sum, slot) => sum + slot.cents, 0)),
      records: [...slots.values()].reduce((sum, slot) => sum + slot.records, 0),
      previousTotal: p.previous ? fromCents([...previousSlots.values()].reduce((sum, slot) => sum + slot.cents, 0)) : null,
    };
  }

  async function categories(filters: ExpenseFilters): Promise<ExpenseCategories> {
    const p = plan(filters);
    const items = await categoryList(filters, p);
    return { items, total: fromCents(sumCents(items.map((item) => item.amount))), records: items.reduce((sum, item) => sum + item.records, 0) };
  }

  async function sources(filters: ExpenseFilters): Promise<ExpenseSources> {
    const p = plan(filters);
    if (!p.effective) return { items: [], total: 0 };
    const [current, previous] = await Promise.all([
      repository.sourceTotals(filters, p.effective),
      p.previous ? repository.sourceTotals(filters, p.previous) : Promise.resolve(null),
    ]);
    const total = sumCents(current.map((item) => item.amount));
    const before = new Map((previous ?? []).map((item) => [item.sourceModule, item.amount]));
    return {
      total: fromCents(total),
      items: current.map((item) => {
        const prior = previous ? before.get(item.sourceModule) ?? 0 : null;
        return {
          ...item,
          share: percentOf(toCents(item.amount), total),
          previousAmount: prior,
          change: prior === null ? null : fromCents(toCents(item.amount) - toCents(prior)),
        };
      }),
    };
  }

  async function drivers(filters: ExpenseFilters): Promise<ExpenseDrivers> {
    const p = plan(filters);
    const none = (reason: string): ExpenseDrivers => ({ available: false, unavailableReason: reason, currentTotal: 0, previousTotal: 0, totalChange: 0, items: [], largestIncrease: null, largestDecrease: null, reconciles: true });
    if (!p.effective) return none("The selected period has not started yet.");
    if (!p.previous) return none(p.info.comparisonNote ?? "Choose a comparison to see what changed.");
    const [current, previous] = await Promise.all([repository.categoryTotals(filters, p.effective), repository.categoryTotals(filters, p.previous)]);
    const totals = new Map<string, { name: string; current: number; previous: number }>();
    for (const item of current) {
      const entry = totals.get(item.categoryId) ?? { name: item.name, current: 0, previous: 0 };
      entry.current += toCents(item.amount);
      totals.set(item.categoryId, entry);
    }
    for (const item of previous) {
      const entry = totals.get(item.categoryId) ?? { name: item.name, current: 0, previous: 0 };
      entry.previous += toCents(item.amount);
      totals.set(item.categoryId, entry);
    }
    const currentTotal = [...totals.values()].reduce((sum, entry) => sum + entry.current, 0);
    const previousTotal = [...totals.values()].reduce((sum, entry) => sum + entry.previous, 0);
    const totalChange = currentTotal - previousTotal;
    const items: DriverItem[] = [...totals.entries()].map(([categoryId, entry]) => {
      const change = entry.current - entry.previous;
      return {
        categoryId,
        name: entry.name,
        current: fromCents(entry.current),
        previous: fromCents(entry.previous),
        change: fromCents(change),
        changePercent: percentChange(entry.current, entry.previous),
        contribution: totalChange !== 0 ? Math.round((change / totalChange) * 10_000) / 100 : null,
        state: entry.previous === 0 && entry.current > 0 ? "new" : entry.current === 0 && entry.previous > 0 ? "stopped" : change > 0 ? "increase" : change < 0 ? "decrease" : "unchanged",
      };
    });
    items.sort((a, b) => Math.abs(toCents(b.change)) - Math.abs(toCents(a.change)) || a.name.localeCompare(b.name));
    const increases = items.filter((item) => item.change > 0).sort((a, b) => b.change - a.change);
    const decreases = items.filter((item) => item.change < 0).sort((a, b) => a.change - b.change);
    const headline = await repository.totals(filters, p.effective);
    const headlinePrevious = await repository.totals(filters, p.previous);
    return {
      available: true,
      unavailableReason: null,
      currentTotal: fromCents(currentTotal),
      previousTotal: fromCents(previousTotal),
      totalChange: fromCents(totalChange),
      items,
      largestIncrease: increases[0] ?? null,
      largestDecrease: decreases[0] ?? null,
      reconciles: sumCents(items.map((item) => item.change)) === totalChange
        && currentTotal === toCents(headline.amount)
        && previousTotal === toCents(headlinePrevious.amount),
    };
  }

  async function matrix(filters: ExpenseFilters): Promise<ExpenseMatrix> {
    const p = plan(filters);
    if (!p.effective) return { categories: [], sources: [], cells: [], total: 0, records: 0, reconciles: true, hasPrevious: false };
    const [current, previous, headline] = await Promise.all([
      repository.matrixTotals(filters, p.effective),
      p.previous ? repository.matrixTotals(filters, p.previous) : Promise.resolve(null),
      repository.totals(filters, p.effective),
    ]);
    const total = sumCents(current.map((item) => item.amount));
    const before = new Map((previous ?? []).map((item) => [`${item.categoryId}|${item.sourceModule}`, item.amount]));
    const rowTotals = new Map<string, { name: string; cents: number; records: number }>();
    const columnTotals = new Map<string, { cents: number; records: number }>();
    const cells: MatrixCell[] = current.map((item) => {
      const row = rowTotals.get(item.categoryId) ?? { name: item.name, cents: 0, records: 0 };
      row.cents += toCents(item.amount);
      row.records += item.records;
      rowTotals.set(item.categoryId, row);
      const column = columnTotals.get(item.sourceModule) ?? { cents: 0, records: 0 };
      column.cents += toCents(item.amount);
      column.records += item.records;
      columnTotals.set(item.sourceModule, column);
      return {
        categoryId: item.categoryId,
        sourceModule: item.sourceModule,
        amount: item.amount,
        records: item.records,
        share: percentOf(toCents(item.amount), total),
        previousAmount: previous ? before.get(`${item.categoryId}|${item.sourceModule}`) ?? 0 : null,
      };
    });
    return {
      categories: [...rowTotals.entries()].map(([categoryId, row]) => ({ categoryId, name: row.name, amount: fromCents(row.cents), records: row.records })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
      sources: [...columnTotals.entries()].map(([sourceModule, column]) => ({ sourceModule, amount: fromCents(column.cents), records: column.records })).sort((a, b) => b.amount - a.amount),
      cells,
      total: fromCents(total),
      records: cells.reduce((sum, cell) => sum + cell.records, 0),
      reconciles: total === toCents(headline.amount),
      hasPrevious: Boolean(previous),
    };
  }

  async function records(query: ExpenseRecordQuery): Promise<ExpenseRecordsPage> {
    const p = plan(query);
    if (!p.effective) return { records: [], total: 0, totalAmount: 0, page: query.page, pageSize: query.pageSize, view: query.view };
    const result = await repository.listRecords(query, query.view, { sortBy: query.sortBy, sortDirection: query.sortDirection }, p.effective, query.page, query.pageSize);
    return { ...result, page: query.page, pageSize: query.pageSize, view: query.view };
  }

  async function integrity(filters: ExpenseFilters): Promise<ExpenseIntegrity> {
    const p = plan(filters);
    if (!p.effective) return { checks: [], reviewCount: 0 };
    return repository.integrity(filters, p.effective, p.today);
  }

  async function budget(filters: ExpenseFilters): Promise<ExpenseBudgetContext> {
    const p = plan(filters);
    return repository.budgetContext(filters, p.effective);
  }

  async function insights(filters: ExpenseFilters): Promise<ExpenseInsight[]> {
    const p = plan(filters);
    if (!p.effective) return [];
    const [overview, categoryData, driverData, integrityData, budgetData] = await Promise.all([
      summary(filters), categories(filters), drivers(filters), integrity(filters), budget(filters),
    ]);
    const scope = `${p.info.effective.startDate ?? "the first record"} to ${p.info.effective.endDate}`;
    const compared = p.previous ? `${p.previous.startDate} to ${p.previous.endDate}` : null;
    const items: ExpenseInsight[] = [];
    if (overview.totals.records === 0) {
      items.push({ id: "none", text: "No posted expenses match the selected period and filters.", basis: `Posted ${filters.classes.map((value) => expenseClassLabels[value].toLowerCase()).join(", ")} records, ${scope}.`, drill: null });
    } else {
      if (overview.change.basis === "ok" && overview.change.amount !== null && overview.change.percent !== null) {
        const direction = overview.change.amount >= 0 ? "higher" : "lower";
        items.push({
          id: "change",
          text: `Posted expenses were ${formatPeso(Math.abs(overview.change.amount))} (${Math.abs(overview.change.percent)}%) ${direction} than the comparison period.`,
          basis: `${formatPeso(overview.totals.amount)} for ${scope} against ${formatPeso(overview.previousTotals?.amount ?? 0)} for ${compared}.`,
          drill: { panel: "drivers" },
        });
      }
      if (driverData.available && driverData.largestIncrease && driverData.totalChange > 0) {
        const lead = driverData.largestIncrease;
        items.push({
          id: "driver-up",
          text: `${lead.name} added the most to the increase: ${formatPeso(lead.change)} more than the comparison period.`,
          basis: `${formatPeso(lead.current)} against ${formatPeso(lead.previous)}; total change ${formatPeso(driverData.totalChange)}.`,
          drill: { categoryId: lead.categoryId, panel: "drivers" },
        });
      } else if (driverData.available && driverData.largestDecrease && driverData.totalChange < 0) {
        const lead = driverData.largestDecrease;
        items.push({
          id: "driver-down",
          text: `${lead.name} accounted for the largest decrease: ${formatPeso(Math.abs(lead.change))} less than the comparison period.`,
          basis: `${formatPeso(lead.current)} against ${formatPeso(lead.previous)}; total change ${formatPeso(driverData.totalChange)}.`,
          drill: { categoryId: lead.categoryId, panel: "drivers" },
        });
      }
      const top = categoryData.items[0];
      if (top?.share !== null && top) {
        items.push({ id: "largest", text: `${top.name} was the largest category at ${formatPeso(top.amount)}, ${top.share}% of posted expenses.`, basis: `${top.records} posted records, ${scope}.`, drill: { categoryId: top.categoryId } });
      }
      const [first, second] = categoryData.items;
      if (first && second) {
        const together = (toCents(first.amount) + toCents(second.amount)) / Math.max(toCents(categoryData.total), 1) * 100;
        if (together >= 60 && categoryData.items.length > 2) {
          items.push({ id: "concentration", text: `Expense activity was concentrated in ${first.name} and ${second.name}, together ${Math.round(together * 10) / 10}% of the total.`, basis: `${categoryData.items.length} categories had posted expenses in ${scope}.`, drill: null });
        }
      }
    }
    const unposted = integrityData.checks.find((check) => check.id === "unposted");
    if (unposted && unposted.records > 0) {
      items.push({ id: "unposted", text: `${unposted.records} expense ${unposted.records === 1 ? "record is" : "records are"} not yet posted (${formatPeso(unposted.amount)}) and not in these totals.`, basis: `Active expense records without a posting approver, ${scope}.`, drill: { view: "unposted" } });
    }
    const unclassified = integrityData.checks.find((check) => check.id === "classification");
    if (unclassified && unclassified.records > 0) {
      items.push({ id: "classification", text: `${unclassified.records} posted ${unclassified.records === 1 ? "record needs" : "records need"} a classification before they can be counted as operating.`, basis: `Posted rows on a category that is not an Expense category, ${scope}.`, drill: { classes: ["unclassified"] } });
    }
    if (budgetData.available && budgetData.lines.length > 0 && budgetData.unbudgeted.categories.length > 0) {
      items.push({ id: "unbudgeted", text: `${budgetData.unbudgeted.categories.length} ${budgetData.unbudgeted.categories.length === 1 ? "category has" : "categories have"} posted expenses with no approved budget line covering ${budgetData.unbudgeted.categories.length === 1 ? "it" : "them"}.`, basis: `${formatPeso(budgetData.unbudgeted.amount)} across ${budgetData.unbudgeted.records} records, ${scope}.`, drill: { panel: "budget" } });
    }
    const pressured = budgetData.lines.filter((line) => line.state === "over" || line.state === "warning");
    for (const line of pressured.slice(0, 2)) {
      items.push({ id: `budget-${line.budgetLineId}`, text: `${line.categoryName} has used ${line.utilization ?? 0}% of its approved ${line.budgetName} limit.`, basis: `${formatPeso(line.spentAmount)} of ${formatPeso(line.limitAmount)}, ${line.coverageStart} to ${line.coverageEnd}.`, drill: { panel: "budget" } });
    }
    return items;
  }

  return {
    plan,
    summary,
    trends,
    categories,
    sources,
    drivers,
    matrix,
    records,
    recordDetail: (id) => repository.recordDetail(id),
    integrity,
    budget,
    insights,
    options: () => repository.filterOptions(),
    repository,
  };
}

export type { ExpenseClass };
