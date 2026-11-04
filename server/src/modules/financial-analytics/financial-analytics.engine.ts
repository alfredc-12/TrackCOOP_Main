import { buildInsights, INSIGHT_RULES, INSIGHT_THRESHOLDS } from "./financial-analytics.insights";
import { addDays, addMonths, buildBuckets, inclusiveDays, MONTH_NAMES, resolveGranularity, startOfMonth, type Bucket } from "./financial-analytics.periods";
import {
  OPERATING_SOURCE_MODULES,
  type BridgeDriver, type CategoryOption, type Concentration, type FinancialAnalyticsFilters, type FinancialAnalyticsResult,
  type FinancialAnalyticsSources, type FinancialFact, type MatrixCell, type NetSurplusBridge, type OperatingType,
  type PeriodDetail, type SeasonalPatterns, type SeasonMonth, type ShareRow, type SourceCategoryMatrix, type TrendPoint,
} from "./financial-analytics.types";

/** Money is integer centavos inside the engine and converted to pesos only at the boundary. */
const peso = (cents: number) => Math.round(cents) / 100;
const round2 = (value: number) => Math.round(value * 100) / 100;
const share = (part: number, whole: number) => (whole > 0 ? round2(part / whole * 100) : null);

/** (current − previous) ÷ |previous| × 100; N/A for a zero base, or when a signed value crosses zero. */
export function percentChange(current: number, previous: number, signed = false): number | null {
  if (previous === 0) return null;
  if (signed && current !== 0 && Math.sign(current) !== Math.sign(previous)) return null;
  return round2((current - previous) / Math.abs(previous) * 100);
}

type Window = { from: string; to: string };
type Totals = { income: number; expenses: number; incomeCount: number; expenseCount: number };

function sum(facts: FinancialFact[], window: Window, keep: (fact: FinancialFact) => boolean = () => true): Totals {
  const totals: Totals = { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 };
  for (const fact of facts) {
    if (fact.date < window.from || fact.date > window.to || !keep(fact)) continue;
    if (fact.type === "Income") { totals.income += fact.cents; totals.incomeCount += fact.count; } else { totals.expenses += fact.cents; totals.expenseCount += fact.count; }
  }
  return totals;
}
const margin = (net: number, income: number) => (income > 0 ? round2(net / income * 100) : null);
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function createFinancialAnalyticsEngine(sources: FinancialAnalyticsSources, filters: FinancialAnalyticsFilters, generatedAt = new Date()) {
  const facts = sources.facts;
  const categoryNames = new Map<string, CategoryOption>(sources.categories.map(category => [category.id, category]));
  const categoryName = (id: string) => categoryNames.get(id)?.name ?? `Category ${id}`;
  const current: Window = { from: filters.start, to: filters.end };
  const first = sources.firstRecordDate;

  // ── Comparison availability ────────────────────────────────────────────────
  const comparisonRange = filters.compare !== "none" && filters.compareStart && filters.compareEnd ? { from: filters.compareStart, to: filters.compareEnd } : null;
  let comparison: Window | null = comparisonRange;
  let comparisonNote: string | null = null;
  let unavailableReason: string | null = null;
  if (comparisonRange && (!first || comparisonRange.to < first)) {
    comparison = null;
    unavailableReason = first ? `No ledger records exist before ${first}, so the comparison period has no coverage.` : "No eligible ledger records exist yet.";
  } else if (comparisonRange && first && comparisonRange.from < first) {
    comparisonNote = `Ledger records begin on ${first}; part of the comparison period has no coverage, so its totals may be understated.`;
  }
  const comparisonDays = comparisonRange ? inclusiveDays(comparisonRange.from, comparisonRange.to) : null;
  const periodLabel = `${filters.start} to ${filters.end}`;
  const comparisonLabel = comparisonRange ? `${comparisonRange.from} to ${comparisonRange.to}` : null;

  const cur = sum(facts, current);
  const prev = comparison ? sum(facts, comparison) : null;
  const scopeAll = filters.recordType === "all";
  const net = cur.income - cur.expenses;
  const prevNet = prev ? prev.income - prev.expenses : null;

  // ── Grouping helpers ───────────────────────────────────────────────────────
  type Group = { cents: number; count: number };
  function group(window: Window, type: OperatingType, key: (fact: FinancialFact) => string) {
    const map = new Map<string, Group>();
    for (const fact of facts) {
      if (fact.type !== type || fact.date < window.from || fact.date > window.to) continue;
      const entry = map.get(key(fact)) ?? { cents: 0, count: 0 };
      entry.cents += fact.cents; entry.count += fact.count; map.set(key(fact), entry);
    }
    return map;
  }

  // ── Trend ──────────────────────────────────────────────────────────────────
  const coverageStart = first && first > filters.start ? first : filters.start;
  const resolved = resolveGranularity(filters.granularity, coverageStart <= filters.end ? coverageStart : filters.end, filters.end);
  const buckets: Bucket[] = first && coverageStart <= filters.end ? buildBuckets(resolved.granularity, coverageStart, filters.end) : [];
  const comparisonBuckets: Bucket[] = comparison ? buildBuckets(resolved.granularity, comparison.from, comparison.to) : [];
  const points: TrendPoint[] = buckets.map((bucket, index) => {
    const totals = sum(facts, bucket);
    const aligned = comparisonBuckets[index];
    const alignedTotals = aligned ? sum(facts, aligned) : null;
    const before = index > 0 ? sum(facts, buckets[index - 1]) : null;
    const basisTotals = alignedTotals ?? before;
    const pointNet = totals.income - totals.expenses;
    const basisNet = basisTotals ? basisTotals.income - basisTotals.expenses : null;
    return {
      key: bucket.key, label: bucket.label, from: bucket.from, to: bucket.to,
      income: peso(totals.income), expenses: peso(totals.expenses), net: peso(pointNet), recordCount: totals.incomeCount + totals.expenseCount,
      previous: alignedTotals ? { income: peso(alignedTotals.income), expenses: peso(alignedTotals.expenses), net: peso(alignedTotals.income - alignedTotals.expenses) } : null,
      change: basisTotals && basisNet !== null ? {
        income: peso(totals.income - basisTotals.income), expenses: peso(totals.expenses - basisTotals.expenses), net: peso(pointNet - basisNet),
        incomePct: percentChange(totals.income, basisTotals.income), expensesPct: percentChange(totals.expenses, basisTotals.expenses), netPct: percentChange(pointNet, basisNet, true),
      } : null,
      changeBasis: alignedTotals ? "comparison" : before ? "preceding" : null,
    };
  });

  // ── Share rows (sources and categories) ────────────────────────────────────
  function shareRows(type: OperatingType, key: (fact: FinancialFact) => string, name: (key: string) => string): ShareRow[] {
    const now = group(current, type, key);
    const before = comparison ? group(comparison, type, key) : null;
    const total = type === "Income" ? cur.income : cur.expenses;
    const series = new Map<string, number[]>();
    for (const fact of facts) {
      if (fact.type !== type || fact.date < filters.start || fact.date > filters.end) continue;
      const index = buckets.findIndex(bucket => fact.date >= bucket.from && fact.date <= bucket.to);
      if (index < 0) continue;
      const values = series.get(key(fact)) ?? buckets.map(() => 0);
      values[index] += fact.cents; series.set(key(fact), values);
    }
    const keys = new Set([...now.keys(), ...(before ? [...before.keys()] : [])]);
    return [...keys].map(k => {
      const amount = now.get(k)?.cents ?? 0; const previousAmount = before ? before.get(k)?.cents ?? 0 : null;
      return {
        key: k, name: name(k), amount: peso(amount), share: share(amount, total), recordCount: now.get(k)?.count ?? 0,
        previousAmount: previousAmount === null ? null : peso(previousAmount),
        change: previousAmount === null ? null : peso(amount - previousAmount),
        changePct: previousAmount === null ? null : percentChange(amount, previousAmount),
        isNew: previousAmount !== null && previousAmount === 0 && amount > 0,
        series: (series.get(k) ?? buckets.map(() => 0)).map(peso),
      };
    }).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  }

  const sourceRows = shareRows("Income", fact => fact.source, key => key);
  const incomeCategoryRows = shareRows("Income", fact => fact.categoryId, categoryName);
  const expenseRows = shareRows("Expense", fact => fact.categoryId, categoryName);
  const concentrationOf = (rows: ShareRow[], total: number): Concentration => {
    const positive = rows.filter(row => row.amount > 0);
    const cumulative = (n: number) => (positive.length > n ? share(Math.round(positive.slice(0, n).reduce((a, r) => a + r.amount, 0) * 100), total * 100) : null);
    return { topShare: positive[0] ? share(Math.round(positive[0].amount * 100), total) : null, topName: positive[0]?.name ?? null, topTwoShare: cumulative(2), topThreeShare: cumulative(3), contributors: positive.length };
  };
  const expensePositive = expenseRows.filter(row => row.amount > 0);
  const topN = (rows: ShareRow[], n: number, totalCents: number) => (rows.length > n ? share(Math.round(rows.slice(0, n).reduce((a, r) => a + r.amount, 0) * 100), totalCents) : null);
  const previousExpenseRows = comparison ? [...group(comparison, "Expense", fact => fact.categoryId).entries()].sort((a, b) => b[1].cents - a[1].cents) : null;

  // ── Net surplus bridge ─────────────────────────────────────────────────────
  function bridge(): NetSurplusBridge {
    const empty = (reason: string): NetSurplusBridge => ({ available: false, reason, previousNet: 0, currentNet: peso(net), totalChange: 0, incomeChange: 0, expenseChange: 0, drivers: [], reconciles: true });
    if (!scopeAll) return empty("The net surplus bridge needs both income and expenses; choose “All eligible operating records”.");
    if (!comparison || !prev || prevNet === null) return empty(unavailableReason ?? "Choose a comparison period to see what changed.");
    const drivers: BridgeDriver[] = [];
    for (const type of ["Income", "Expense"] as const) {
      const now = group(current, type, fact => fact.categoryId); const before = group(comparison, type, fact => fact.categoryId);
      for (const id of new Set([...now.keys(), ...before.keys()])) {
        const a = now.get(id)?.cents ?? 0; const b = before.get(id)?.cents ?? 0;
        if (a === 0 && b === 0) continue;
        drivers.push({ key: `${type}:${id}`, categoryId: id, name: categoryName(id), type, current: peso(a), previous: peso(b), effect: peso(type === "Income" ? a - b : -(a - b)), share: null, status: b === 0 ? "new" : a === 0 ? "discontinued" : "continuing" });
      }
    }
    const effects = drivers.reduce((total, driver) => total + Math.round(driver.effect * 100), 0);
    const totalChange = net - prevNet;
    if (effects !== totalChange) throw new Error(`Net surplus bridge does not reconcile: drivers ${effects} vs change ${totalChange} centavos`);
    for (const driver of drivers) driver.share = totalChange === 0 ? null : round2(Math.round(driver.effect * 100) / totalChange * 100);
    drivers.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect) || a.name.localeCompare(b.name));
    return { available: true, reason: null, previousNet: peso(prevNet), currentNet: peso(net), totalChange: peso(totalChange), incomeChange: peso(cur.income - prev.income), expenseChange: peso(cur.expenses - prev.expenses), drivers, reconciles: true };
  }

  // ── Seasonality (ignores the reporting period; honors every other filter) ──
  function seasonality(): SeasonalPatterns {
    const min = INSIGHT_THRESHOLDS.seasonalityMinYears;
    const monthly = new Map<string, { income: number; expenses: number }>();
    for (const fact of facts) {
      const key = fact.date.slice(0, 7); const entry = monthly.get(key) ?? { income: 0, expenses: 0 };
      if (fact.type === "Income") entry.income += fact.cents; else entry.expenses += fact.cents;
      monthly.set(key, entry);
    }
    const lastFull = addMonths(startOfMonth(filters.asOf), -1).slice(0, 7);
    const firstFull = first ? addMonths(startOfMonth(first), 1).slice(0, 7) : null;
    const complete: Array<{ year: number; month: number; income: number; expenses: number }> = [];
    if (firstFull && firstFull <= lastFull) {
      for (let cursor = `${firstFull}-01`; cursor.slice(0, 7) <= lastFull; cursor = addMonths(cursor, 1)) {
        const value = monthly.get(cursor.slice(0, 7)) ?? { income: 0, expenses: 0 };
        complete.push({ year: Number(cursor.slice(0, 4)), month: Number(cursor.slice(5, 7)), ...value });
      }
    }
    const months: SeasonMonth[] = MONTH_NAMES.map((name, index) => {
      const rows = complete.filter(row => row.month === index + 1);
      const incomes = rows.map(r => r.income); const expenses = rows.map(r => r.expenses); const nets = rows.map(r => r.income - r.expenses);
      const high = rows.length ? rows.reduce((a, r) => (r.income - r.expenses > a.income - a.expenses ? r : a)) : null;
      const low = rows.length ? rows.reduce((a, r) => (r.income - r.expenses < a.income - a.expenses ? r : a)) : null;
      const p = (value: number | null) => (value === null ? null : peso(value));
      return {
        month: index + 1, name, observations: rows.length, years: rows.map(r => r.year),
        incomeAverage: p(mean(incomes)), incomeMedian: p(median(incomes)), expenseAverage: p(mean(expenses)), expenseMedian: p(median(expenses)),
        netAverage: p(mean(nets)), netMedian: p(median(nets)),
        highNet: high ? { year: high.year, value: peso(high.income - high.expenses) } : null, lowNet: low ? { year: low.year, value: peso(low.income - low.expenses) } : null,
      };
    });
    const established = complete.length > 0 && months.every(month => month.observations >= min);
    const years = new Set(complete.map(row => row.year)).size;
    const best = (pick: (m: SeasonMonth) => number | null, dir: 1 | -1) => (established ? months.reduce<SeasonMonth | null>((a, m) => { const v = pick(m); if (v === null) return a; if (!a) return m; const av = pick(a)!; return (v - av) * dir > 0 ? m : a; }, null) : null);
    const monthsNeeded = Math.max(0, 12 * min - complete.length);
    const statement = established
      ? `Each calendar month has at least ${min} complete comparable years of recorded history (${complete.length} complete months). Patterns describe recorded ledger activity only.`
      : complete.length === 0
        ? "No complete calendar month of ledger history exists yet, so there is no monthly pattern to show."
        : `Only ${complete.length} complete month${complete.length === 1 ? "" : "s"} across ${years} calendar year${years === 1 ? "" : "s"} are recorded. Seasonality needs at least ${min} complete years for every month (about ${monthsNeeded} more months), so these figures are shown as a monthly trend, not an established seasonal pattern.`;
    return {
      firstFullMonth: complete[0] ? `${complete[0].year}-${String(complete[0].month).padStart(2, "0")}` : null,
      lastFullMonth: complete.length ? `${complete[complete.length - 1].year}-${String(complete[complete.length - 1].month).padStart(2, "0")}` : null,
      completeMonths: complete.length, yearsObserved: years, minimumYears: min, established, statement, months,
      grid: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), income: peso(value.income), expenses: peso(value.expenses), net: peso(value.income - value.expenses), complete: key >= (firstFull ?? "9999") && key <= lastFull })),
      strongest: { income: best(m => m.incomeAverage, 1), expense: best(m => m.expenseAverage, 1), net: best(m => m.netAverage, 1) },
      weakest: { net: best(m => m.netAverage, -1) },
    };
  }

  // ── Operational contribution (ledger-based; never added to the headline) ───
  const operational = (["POS", "Rental"] as const).map(module => {
    const now = sum(facts, current, fact => fact.type === "Income" && fact.source === module);
    const before = comparison ? sum(facts, comparison, fact => fact.type === "Income" && fact.source === module) : null;
    const byCategory = group(current, "Income", fact => (fact.source === module ? fact.categoryId : "")); byCategory.delete("");
    return {
      module, income: peso(now.income), share: share(now.income, cur.income), previousIncome: before ? peso(before.income) : null,
      change: before ? peso(now.income - before.income) : null, recordCount: now.incomeCount,
      categories: [...byCategory.entries()].map(([id, g]) => ({ name: categoryName(id), amount: peso(g.cents) })).sort((a, b) => b.amount - a.amount),
      link: module === "POS" ? "/portal/chairman/pos" : "/portal/chairman/rentals",
    };
  });

  // ── Assemble ───────────────────────────────────────────────────────────────
  const largestExpense = expensePositive[0];
  const state: FinancialAnalyticsResult["overview"]["state"] = cur.incomeCount + cur.expenseCount === 0 ? "no-records" : scopeAll && net < 0 ? "deficit" : cur.incomeCount === 0 ? "no-income" : cur.expenseCount === 0 ? "no-expenses" : "ok";
  const overview: FinancialAnalyticsResult["overview"] = {
    scope: filters.recordType,
    income: peso(cur.income), expenses: peso(cur.expenses), net: scopeAll ? peso(net) : null, margin: scopeAll ? margin(net, cur.income) : null,
    previous: prev ? { income: peso(prev.income), expenses: peso(prev.expenses), net: scopeAll ? peso(prevNet!) : null, margin: scopeAll ? margin(prevNet!, prev.income) : null } : null,
    comparisonUnavailableReason: unavailableReason,
    incomeChange: prev ? peso(cur.income - prev.income) : null, incomeChangePct: prev ? percentChange(cur.income, prev.income) : null,
    expenseChange: prev ? peso(cur.expenses - prev.expenses) : null, expenseChangePct: prev ? percentChange(cur.expenses, prev.expenses) : null,
    netChange: prev && scopeAll ? peso(net - prevNet!) : null, netChangePct: prev && scopeAll ? percentChange(net, prevNet!, true) : null,
    marginChangePoints: prev && scopeAll && margin(net, cur.income) !== null && margin(prevNet!, prev.income) !== null ? round2(margin(net, cur.income)! - margin(prevNet!, prev.income)!) : null,
    largestExpenseCategory: largestExpense ? { name: largestExpense.name, amount: largestExpense.amount, share: largestExpense.share } : null,
    recordCount: cur.incomeCount + cur.expenseCount, incomeCount: cur.incomeCount, expenseCount: cur.expenseCount, state,
  };
  const bridgeResult = bridge();
  const seasonal = seasonality();
  const comparisonResult = { enabled: Boolean(comparison), mode: filters.compare, start: comparisonRange?.from ?? null, end: comparisonRange?.to ?? null, label: comparisonRange ? ({ previous: "Previous equivalent period", "last-year": "Same period last year", custom: "Custom comparison", none: "No comparison" }[filters.compare]) : "No comparison", days: comparisonDays, currentDays: inclusiveDays(filters.start, filters.end), note: unavailableReason ?? comparisonNote ?? (comparisonDays !== null && comparisonDays !== inclusiveDays(filters.start, filters.end) ? `The comparison covers ${comparisonDays} days against ${inclusiveDays(filters.start, filters.end)} in the reporting period, so totals are not like-for-like.` : null) };
  const integrity = { ...sources.integrity, refreshedAt: generatedAt.toISOString() };
  const core = {
    overview, incomeSources: { total: peso(cur.income), rows: sourceRows, concentration: concentrationOf(sourceRows, cur.income) },
    expenseCategories: {
      total: peso(cur.expenses), rows: expenseRows, count: cur.expenseCount, averageAmount: cur.expenseCount ? peso(cur.expenses / cur.expenseCount) : null,
      concentration: { top1: expensePositive[0] ? share(Math.round(expensePositive[0].amount * 100), cur.expenses) : null, top3: topN(expensePositive, 3, cur.expenses), top5: topN(expensePositive, 5, cur.expenses) },
      previousConcentration: previousExpenseRows && previousExpenseRows.length ? {
        top1Name: categoryName(previousExpenseRows[0][0]),
        top3: previousExpenseRows.length > 3 ? share(previousExpenseRows.slice(0, 3).reduce((a, [, g]) => a + g.cents, 0), prev!.expenses) : null,
      } : null,
    },
    netSurplusBridge: bridgeResult, seasonalPatterns: seasonal, recordIntegrity: integrity, periodLabel, comparisonLabel, comparison: comparisonResult, filters,
  };

  const result: FinancialAnalyticsResult = {
    metadata: {
      generatedAt: generatedAt.toISOString(), timezone: "Asia/Manila", currency: "PHP", firstRecordDate: first,
      eligibleRecordCount: facts.reduce((total, fact) => total + fact.count, 0),
      definitions: [
        { metric: "Eligible record", definition: "A ledger row with status Active, an approver (posted), type Income or Expense, and not a Share Capital movement. Voided, Corrected and Reversed rows, unposted rows and Adjustments never enter these totals." },
        { metric: "Recorded Operating Income", definition: "Sum of eligible Income records dated within the reporting period, excluding share-capital movements. Not audited revenue." },
        { metric: "Recorded Operating Expenses", definition: "Sum of eligible Expense records dated within the reporting period, excluding share-capital movements such as dividend withdrawals." },
        { metric: "Recorded Net Surplus", definition: "Recorded Operating Income − Recorded Operating Expenses. Indicative only; not an audited or distributable surplus." },
        { metric: "Recorded Surplus Margin", definition: "Recorded Net Surplus ÷ Recorded Operating Income × 100, only when income is greater than zero." },
        { metric: "Percentage change", definition: "(Current − Comparison) ÷ |Comparison| × 100; N/A when the comparison is zero, or when a net figure crosses zero (use the peso change)." },
        { metric: "Net surplus bridge", definition: "ΔNet Surplus = ΔIncome − ΔExpenses by category: income increases and expense decreases raise the surplus. Drivers always sum to the change." },
        { metric: "Source / category share", definition: "Amount ÷ total eligible income (or expenses) for the same filters × 100." },
        { metric: "Seasonality", definition: `Average and median of complete calendar months across years. Reported as established only with at least ${INSIGHT_THRESHOLDS.seasonalityMinYears} complete years for every month. The reporting period does not apply.` },
        { metric: "Operational sources", definition: "POS and Rental figures are the posted ledger income attributed to those source modules. Operational sales tables are used only for reconciliation and are never added to headline totals." },
      ],
      limitations: [
        { code: "no-classification-engine", message: "TrackCOOP has no controlled accounting classification beyond Income, Expense and Adjustment; figures are labelled “recorded” and are not CDA financial statements." },
        { code: "capital-excluded", message: "Share Capital movements, including dividend withdrawals recorded against capital accounts, are excluded from operating results until an approved accounting policy exists." },
        { code: "audit-filters", message: "Posting status, record status and recorder/approver are audit views (see Financial Data Integrity) and do not change headline totals." },
        ...(first ? [] : [{ code: "no-records", message: "No eligible ledger records exist yet." }]),
      ],
      insightRules: INSIGHT_RULES, thresholds: { ...INSIGHT_THRESHOLDS },
    },
    filters, periodLabel, comparisonLabel, comparison: comparisonResult,
    options: { categories: sources.categories, sourceModules: OPERATING_SOURCE_MODULES },
    overview,
    performanceTrend: { granularity: resolved.granularity, requested: filters.granularity, note: resolved.note, coverageStart: first, points },
    incomeSources: core.incomeSources,
    incomeCategories: { total: peso(cur.income), rows: incomeCategoryRows },
    expenseCategories: core.expenseCategories,
    netSurplusBridge: bridgeResult, seasonalPatterns: seasonal, recordIntegrity: integrity, operationalSources: operational,
    insights: buildInsights(core), capitalContext: sources.capital,
  };

  // Reconciliation invariants: investigated, never silently replaced by zero.
  const total = (rows: ShareRow[]) => rows.reduce((a, r) => a + Math.round(r.amount * 100), 0);
  if (total(sourceRows) !== cur.income || total(incomeCategoryRows) !== cur.income || total(expenseRows) !== cur.expenses) {
    throw new Error("Financial analytics does not reconcile: source or category totals differ from the eligible totals");
  }

  function matrix(classification: OperatingType): SourceCategoryMatrix {
    const present = OPERATING_SOURCE_MODULES.filter(source => facts.some(fact => fact.type === classification && fact.source === source));
    const now = new Map<string, Group>(); const before = new Map<string, Group>();
    const add = (map: Map<string, Group>, fact: FinancialFact) => { const k = `${fact.categoryId}|${fact.source}`; const g = map.get(k) ?? { cents: 0, count: 0 }; g.cents += fact.cents; g.count += fact.count; map.set(k, g); };
    for (const fact of facts) {
      if (fact.type !== classification) continue;
      if (fact.date >= current.from && fact.date <= current.to) add(now, fact);
      if (comparison && fact.date >= comparison.from && fact.date <= comparison.to) add(before, fact);
    }
    const totalNow = classification === "Income" ? cur.income : cur.expenses;
    const totalBefore = prev ? (classification === "Income" ? prev.income : prev.expenses) : null;
    const sourceTotal = (source: string, map: Map<string, Group>) => [...map.entries()].filter(([k]) => k.endsWith(`|${source}`)).reduce((a, [, g]) => a + g.cents, 0);
    const categories = new Set([...now.keys(), ...before.keys()].map(k => k.split("|")[0]));
    const rows = [...categories].map(id => {
      const cells: Record<string, MatrixCell> = {};
      for (const source of present) {
        const a = now.get(`${id}|${source}`); const b = before.get(`${id}|${source}`);
        const cents = a?.cents ?? 0; const previousCents = comparison ? b?.cents ?? 0 : null;
        cells[source] = { amount: peso(cents), count: a?.count ?? 0, previousAmount: previousCents === null ? null : peso(previousCents), change: previousCents === null ? null : peso(cents - previousCents), shareOfTotal: share(cents, totalNow), shareOfSource: share(cents, sourceTotal(source, now)) };
      }
      const rowCents = present.reduce((a, s) => a + Math.round(cells[s].amount * 100), 0); const rowPrev = comparison ? present.reduce((a, s) => a + Math.round((cells[s].previousAmount ?? 0) * 100), 0) : null;
      return { categoryId: id, name: categoryName(id), total: peso(rowCents), count: present.reduce((a, s) => a + cells[s].count, 0), previousTotal: rowPrev === null ? null : peso(rowPrev), change: rowPrev === null ? null : peso(rowCents - rowPrev), cells };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const sourceTotals = Object.fromEntries(present.map(source => [source, { amount: peso(sourceTotal(source, now)), count: [...now.entries()].filter(([k]) => k.endsWith(`|${source}`)).reduce((a, [, g]) => a + g.count, 0), previousAmount: comparison ? peso(sourceTotal(source, before)) : null }]));
    const cellsTotal = rows.reduce((a, r) => a + Math.round(r.total * 100), 0);
    if (cellsTotal !== totalNow) throw new Error(`Source × category matrix does not reconcile: ${cellsTotal} vs ${totalNow} centavos`);
    return { classification, sources: present, rows, sourceTotals, total: peso(totalNow), previousTotal: totalBefore === null ? null : peso(totalBefore), reconciles: true };
  }

  function periodDetail(window: Window): PeriodDetail {
    const totals = sum(facts, window);
    const named = (type: OperatingType) => [...group(window, type, fact => fact.categoryId).entries()].map(([id, g]) => ({ name: categoryName(id), amount: peso(g.cents), count: g.count })).sort((a, b) => b.amount - a.amount);
    const days = new Map<string, { income: number; expenses: number; count: number }>();
    const bySource = new Map<string, { income: number; expenses: number }>();
    for (const fact of facts) {
      if (fact.date < window.from || fact.date > window.to) continue;
      const day = days.get(fact.date) ?? { income: 0, expenses: 0, count: 0 }; const src = bySource.get(fact.source) ?? { income: 0, expenses: 0 };
      if (fact.type === "Income") { day.income += fact.cents; src.income += fact.cents; } else { day.expenses += fact.cents; src.expenses += fact.cents; }
      day.count += fact.count; days.set(fact.date, day); bySource.set(fact.source, src);
    }
    const length = inclusiveDays(window.from, window.to);
    const priorWindow = { from: addDays(window.from, -length), to: addDays(window.from, -1) };
    const before = !first || priorWindow.to < first ? null : sum(facts, priorWindow);
    return {
      from: window.from, to: window.to, income: peso(totals.income), expenses: peso(totals.expenses), net: peso(totals.income - totals.expenses), recordCount: totals.incomeCount + totals.expenseCount,
      incomeCategories: named("Income"), expenseCategories: named("Expense"),
      sources: [...bySource.entries()].map(([source, v]) => ({ source, income: peso(v.income), expenses: peso(v.expenses) })),
      daily: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, income: peso(v.income), expenses: peso(v.expenses), net: peso(v.income - v.expenses), count: v.count })),
      previous: before ? { income: peso(before.income), expenses: peso(before.expenses), net: peso(before.income - before.expenses) } : null,
    };
  }

  return { result, matrix, periodDetail };
}

export type FinancialAnalyticsEngine = ReturnType<typeof createFinancialAnalyticsEngine>;
