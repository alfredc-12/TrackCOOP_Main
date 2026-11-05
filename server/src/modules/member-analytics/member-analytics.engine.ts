import { addDays, capitalStages, daysBetween, localDate, normalizeBarangay } from "./member-analytics.filters";
import { ANALYTICS_SECTORS, ENGAGEMENT_LABELS, type AnalyticsFilters, type AnalyticsIndicator, type AnalyticsMember, type AnalyticsResult, type AnalyticsSelection, type AnalyticsSources } from "./member-analytics.types";
import { NASUGBU_BARANGAYS } from "./nasugbu-barangays";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const rate = (n: number, d: number) => d ? round(n / d * 100) : null;
function statistics(values: number[]) {
  const sorted = values.filter(n => n >= 0).sort((a, b) => a - b);
  return { average: sorted.length ? round(sum(sorted) / sorted.length) : null,
    median: sorted.length ? round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2) : null };
}
function months(start: string, end: string) {
  const result: string[] = [];
  for (let d = new Date(`${start.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= end.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) result.push(d.toISOString().slice(0, 7));
  return result;
}
function previousYear(date: string) {
  const year = Number(date.slice(0, 4)) - 1;
  return date.slice(5) === "02-29" ? `${year}-02-28` : `${year}${date.slice(4)}`;
}
function grouped<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T[]>();
  for (const row of rows) { const k = key(row); result.set(k, [...(result.get(k) ?? []), row]); }
  return result;
}
function compatible(a: AnalyticsIndicator, b: AnalyticsIndicator) {
  // Match calendar-window semantics across different calculation days and leap years.
  // Custom partial windows require the same observed day span instead.
  const basis = (i: AnalyticsIndicator) => {
    const monthSpan = (Number(i.end.slice(0, 4)) - Number(i.start.slice(0, 4))) * 12 + Number(i.end.slice(5, 7)) - Number(i.start.slice(5, 7));
    const shift = (months: number) => {
      const date = new Date(`${i.start.slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + months);
      const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(Number(i.start.slice(8)), last)); return date.toISOString().slice(0, 10);
    };
    if (shift(monthSpan) === i.end) return `calendar:${monthSpan}`;
    if (shift(monthSpan + 1) === addDays(i.end, 1)) return `inclusive-calendar:${monthSpan + 1}`;
    return `days:${daysBetween(i.start, i.end)}`;
  };
  return Boolean(a.fingerprint && a.fingerprint === b.fingerprint && a.version === b.version && basis(a) === basis(b));
}

export function createAnalyticsEngine(source: AnalyticsSources, filters: AnalyticsFilters, generatedAt = new Date().toISOString()) {
  const appByMember = grouped(source.applications.filter(a => a.memberId), a => a.memberId!);
  const appHistory = grouped(source.applicationHistory, h => h.id);
  const statusHistory = grouped(source.statusHistory, h => h.memberId);
  const indicators = grouped(source.indicators, i => i.memberId);
  for (const rows of indicators.values()) rows.sort((a, b) => b.computedAt.localeCompare(a.computedAt) || Number(b.id) - Number(a.id));
  const entries = grouped(source.capital, e => e.memberId);
  const paymentRows = grouped(source.capitalPayments, p => p.memberId);
  const participation = grouped(source.participation, p => p.memberId);
  const accounts = new Map(source.accounts.map(a => [a.memberId, a.balance]));
  const validated = new Set(source.validatedApplications);
  const approval = (m: AnalyticsMember) => m.approvedAt ? localDate(m.approvedAt) : (appByMember.get(m.id) ?? []).flatMap(a => appHistory.get(a.id) ?? []).filter(h => h.status === "Approved").map(h => localDate(h.at)).sort()[0] ?? null;
  const undated = source.members.filter(m => m.approvalStatus === "Approved" && !approval(m)).length;
  const indicatorAt = (id: string, date: string) => indicators.get(id)?.find(i => localDate(i.computedAt) <= date && i.end <= date);
  const capitalAt = (id: string, date: string) => {
    const ledger = (entries.get(id) ?? []).filter(e => e.date <= date);
    const balance = round(sum(ledger.map(e => e.direction === "Credit" ? e.amount : -e.amount)));
    const ledgerPayments = new Set(ledger.filter(e => e.source === "share_capital_payment").map(e => e.sourceId));
    const missingPayment = (paymentRows.get(id) ?? []).some(p => p.date <= date && !ledgerPayments.has(p.id));
    const currentLedger = round(sum((entries.get(id) ?? []).map(e => e.direction === "Credit" ? e.amount : -e.amount)));
    const mismatch = accounts.has(id) && Math.abs(accounts.get(id)! - currentLedger) > .01;
    const known = Boolean(source.capabilities.share_capital_transactions && source.capabilities.share_capital_accounts && source.capabilities.share_capital_payments && !missingPayment && !mismatch && balance >= 0 && !(currentLedger !== 0 && !accounts.has(id)) && !(accounts.get(id) && !entries.has(id)));
    const stage = !known ? "Unknown ledger" : balance === 0 ? capitalStages[0] : balance < source.settings.target ? capitalStages[1] : balance < source.settings.maximum ? capitalStages[2] : balance === source.settings.maximum ? capitalStages[3] : capitalStages[4];
    return { balance, known, stage };
  };
  const snapshot = (m: AnalyticsMember, date: string) => {
    const history = (statusHistory.get(m.id) ?? []).filter(h => localDate(h.at) <= date).sort((a, b) => b.at.localeCompare(a.at) || (b.id ?? "").localeCompare(a.id ?? "", "en", { numeric: true }))[0];
    return { ...m, membershipType: history?.membershipType ?? m.membershipType, officialStatus: history?.officialStatus ?? m.officialStatus,
      approved: approval(m), engagement: indicatorAt(m.id, date)?.label ?? "Not Yet Scored", capital: capitalAt(m.id, date) };
  };
  const population = (date: string) => source.members.filter(m => m.approvalStatus === "Approved" && approval(m) && approval(m)! <= date).map(m => snapshot(m, date)).filter(m =>
    (!filters.barangays.length || filters.barangays.some(b => normalizeBarangay(b) === normalizeBarangay(m.barangay))) &&
    (!filters.sectors.length || (m.selectedSectors?.length ? m.selectedSectors : [m.sector ?? ""]).some(sector => filters.sectors.includes(sector))) &&
    (!filters.membershipType || m.membershipType === filters.membershipType) &&
    (!filters.officialStatus || m.officialStatus === filters.officialStatus) &&
    (!filters.engagement || m.engagement === filters.engagement) &&
    (!filters.capitalStage || m.capital.stage === filters.capitalStage) &&
    (!filters.source || (appByMember.get(m.id) ?? []).some(a => a.source === filters.source)));
  const members = population(filters.asOf);
  type SnapshotMember = typeof members[number];
  const before = population(addDays(filters.start, -1));
  const atEnd = population(filters.end);
  const periodApproval = (m: SnapshotMember) => m.approved! >= filters.start && m.approved! <= filters.end;
  const newMembers = members.filter(periodApproval);
  const eligible = members.filter(m => m.membershipType === "True Member");
  const completed = eligible.filter(m => m.capital.known && m.capital.balance >= source.settings.target);
  const provisional = (m: SnapshotMember) => (appByMember.get(m.id) ?? []).some(a => a.requestedType === "True Member");
  const overdue = (m: SnapshotMember) => Boolean((m.membershipType === "True Member" || provisional(m)) && m.deadline && m.deadline < filters.asOf && m.capital.known && m.capital.balance < source.settings.target);
  const attention = (m: SnapshotMember) => ["Needs Monitoring", "Inactive"].includes(m.engagement) || overdue(m);
  const obligation = (m: SnapshotMember) => m.membershipType === "True Member" || provisional(m);
  const deadlineCategory = (m: SnapshotMember) => !m.capital.known ? "Unknown balance" : m.capital.balance >= source.settings.target ? "Completed" : !m.deadline ? "Unknown deadline" : overdue(m) ? "Overdue" : m.deadline <= addDays(filters.asOf, 30) ? "Due within 30 days" : "Pending";
  const cohortMonths = [...new Set(newMembers.map(m => m.approved!.slice(0, 7)))].sort();
  const cohorts = cohortMonths.flatMap(month => [30, 60, 90].map(days => {
    const cohort = newMembers.filter(m => m.approved!.startsWith(month));
    const mature = cohort.filter(m => addDays(m.approved!, days) <= filters.asOf);
    const participated = mature.filter(m => (participation.get(m.id) ?? []).some(p => p.date >= m.approved! && p.date <= addDays(m.approved!, days))).length;
    return { month, days, total: cohort.length, mature: mature.length, participated, rate: source.capabilities.cooperative_activities && source.capabilities.member_activity_participation ? rate(participated, mature.length) : null };
  }));
  const mature90 = sum(cohorts.filter(c => c.days === 90).map(c => c.mature));
  const participated90 = sum(cohorts.filter(c => c.days === 90).map(c => c.participated));
  const monthList = months(filters.start, filters.end);
  const growth = monthList.map(month => {
    const last = addDays(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10), -1);
    const end = last < filters.end ? last : filters.end;
    const start = `${month}-01` > filters.start ? `${month}-01` : filters.start;
    const approvals = members.filter(m => m.approved! >= start && m.approved! <= end);
    return { month, newMembers: approvals.length, associates: approvals.filter(m => m.membershipType === "Associate").length, trueMembers: approvals.filter(m => m.membershipType === "True Member").length,
      cumulative: population(end).length,
      previousNew: population(previousYear(end)).filter(m => m.approved! >= previousYear(start) && m.approved! <= previousYear(end)).length };
  });
  const latestIndicators = members.flatMap(m => { const i = indicatorAt(m.id, filters.asOf); return i ? [i] : []; });
  const movements: AnalyticsResult["engagement"]["movement"] = [];
  let comparable = 0;
  for (const m of members) {
    const current = indicatorAt(m.id, filters.asOf), prior = indicatorAt(m.id, addDays(filters.start, -1));
    if (!current || !prior || current.id === prior.id || !compatible(current, prior)) continue;
    comparable++;
    const existing = movements.find(v => v.from === prior.label && v.to === current.label);
    if (existing) existing.count++; else movements.push({ from: prior.label, to: current.label, count: 1 });
  }
  const completionDate = (m: SnapshotMember) => {
    if (!m.capital.known) return null;
    let balance = 0;
    for (const entry of [...(entries.get(m.id) ?? [])].filter(e => e.date <= filters.asOf).sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id))) {
      balance = round(balance + (entry.direction === "Credit" ? entry.amount : -entry.amount));
      if (balance >= source.settings.target) return entry.date;
    }
    return null;
  };
  const durations = members.filter(m => m.membershipType === "True Member" || provisional(m)).flatMap(m => { const date = completionDate(m); return date && date >= m.approved! ? [daysBetween(m.approved!, date)] : []; });
  const stats = statistics(durations);
  const memberIds = new Set(members.map(m => m.id));
  const periodEntries = source.capital.filter(e => memberIds.has(e.memberId) && e.date >= filters.start && e.date <= filters.end);
  const isCash = (e: typeof periodEntries[number]) => e.source === "share_capital_payment" && !/patronage|dividend|interest/i.test(e.paymentSource ?? "");
  const isInterest = (e: typeof periodEntries[number]) => /dividend|interest/i.test(`${e.type} ${e.source}`);
  const priorMembers = population(previousYear(filters.asOf));
  const barangays = [...new Set([...members, ...priorMembers].map(m => m.barangay?.trim() || "Unspecified"))];
  // Fold aliases into a single geographic row, retaining an actual display label.
  const canonicalBarangays = [...new Map([...barangays, ...NASUGBU_BARANGAYS].map(b => [normalizeBarangay(b), b])).values()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const geography = canonicalBarangays.map(barangay => {
    const rows = members.filter(m => normalizeBarangay(m.barangay || "Unspecified") === normalizeBarangay(barangay));
    const previous = priorMembers.filter(m => normalizeBarangay(m.barangay || "Unspecified") === normalizeBarangay(barangay));
    return { barangay, totalMembers: rows.length, trueMembers: rows.filter(m => m.membershipType === "True Member").length, associates: rows.filter(m => m.membershipType === "Associate").length,
      sectorCounts: Object.fromEntries(ANALYTICS_SECTORS.map(s => [s, rows.filter(m => m.sector === s).length])),
      engagementCounts: Object.fromEntries(ENGAGEMENT_LABELS.map(s => [s, rows.filter(m => m.engagement === s).length])),
      newApprovals: rows.filter(periodApproval).length, previousMembers: previous.length, change: rows.length - previous.length,
      cells: ANALYTICS_SECTORS.map(sector => { const cell = rows.filter(m => m.sector === sector); return { sector, members: cell.length, newApprovals: cell.filter(periodApproval).length, engaged: cell.filter(m => m.engagement === "Active").length, change: cell.length - previous.filter(m => m.sector === sector).length, periodChange: cell.length - before.filter(m => m.sector === sector && normalizeBarangay(m.barangay || "Unspecified") === normalizeBarangay(barangay)).length }; }) };
  });
  const monthly = growth.map(g => ({ month: g.month, count: g.newMembers }));
  const yearly = [...grouped(monthly, m => m.month.slice(0, 4))].map(([year, rows]) => ({ year, count: sum(rows.map(r => r.count)) }));
  const bestMonth = [...monthly].sort((a, b) => b.count - a.count || a.month.localeCompare(b.month))[0] ?? null;
  const quarters = monthly.slice(2).map((m, i) => ({ start: monthly[i].month, end: m.month, count: sum(monthly.slice(i, i + 3).map(r => r.count)) }));
  const bestQuarter = quarters.sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))[0] ?? null;
  const apps = source.applications.filter(a => localDate(a.submittedAt) >= filters.start && localDate(a.submittedAt) <= filters.end &&
    (!filters.source || a.source === filters.source) && (!filters.barangays.length || filters.barangays.some(b => normalizeBarangay(b) === normalizeBarangay(a.barangay))) &&
    (!filters.sectors.length || filters.sectors.includes(a.sector ?? "")) && (!filters.membershipType || a.requestedType === filters.membershipType) &&
    (!(filters.engagement || filters.officialStatus || filters.capitalStage) || Boolean(a.memberId && memberIds.has(a.memberId))));
  const journeyStages = ["Submitted", "Under Review", "Payment Required", "Payment Confirmed", "Approved", "Capital Complete", "First Participation"];
  const journeyDates = apps.map(a => {
    const dates = new Map<string, string>([["Submitted", localDate(a.submittedAt)]]);
    for (const h of (appHistory.get(a.id) ?? []).filter(h => localDate(h.at) <= filters.asOf).sort((a, b) => a.at.localeCompare(b.at))) if (!dates.has(h.status)) dates.set(h.status, localDate(h.at));
    const member = members.find(m => m.id === a.memberId);
    if (member) {
      if (!dates.has("Approved")) dates.set("Approved", member.approved!);
      if (member.membershipType === "True Member" || provisional(member)) { const date = completionDate(member); if (date) dates.set("Capital Complete", date); }
      const first = (participation.get(member.id) ?? []).filter(p => p.date >= member.approved! && p.date <= filters.asOf).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (first) dates.set("First Participation", first.date);
    }
    return { application: a, dates };
  });
  const journey = journeyStages.map(stage => {
    const reached = journeyDates.filter(j => j.dates.has(stage));
    const duration = statistics(reached.map(j => daysBetween(j.dates.get("Submitted")!, j.dates.get(stage)!)));
    const nextStage: Record<string, string[]> = { "Submitted": ["Under Review", "Approved", "Rejected", "Withdrawn"], "Under Review": ["Payment Required", "Payment Confirmed", "Approved", "Rejected"], "Payment Required": ["Payment Confirmed"], "Payment Confirmed": ["Approved"], "Approved": ["Capital Complete", "First Participation"] };
    const completed = reached.flatMap(j => {
      const start = j.dates.get(stage)!;
      const finish = (nextStage[stage] ?? []).map(s => j.dates.get(s)).filter((d): d is string => Boolean(d && d >= start)).sort()[0];
      return finish ? [daysBetween(start, finish)] : [];
    });
    const processing = statistics(completed);
    return { stage, count: reached.length, averageDays: duration.average, medianDays: duration.median,
      completed: completed.length, unresolved: nextStage[stage] ? reached.length - completed.length : 0,
      stageRate: nextStage[stage] ? rate(completed.length, reached.length) : null, processingAverage: processing.average, processingMedian: processing.median };
  });
  const referrals = source.referrals.filter(r => memberIds.has(r.referrerId) && localDate(r.createdAt) >= filters.start && localDate(r.createdAt) <= filters.end);
  const qualified = referrals.filter(r => r.status === "Successful" && r.qualifiedAt && localDate(r.qualifiedAt) <= filters.asOf && r.memberId && source.members.some(m => m.id === r.memberId && m.approvalStatus === "Approved" && approval(m) && approval(m)! <= filters.asOf) && validated.has(r.applicationId));
  const previousEligible = priorMembers.filter(m => m.membershipType === "True Member");
  const availability = {
    capital: Boolean(source.capabilities.share_capital_transactions && source.capabilities.share_capital_accounts && source.capabilities.share_capital_payments),
    engagement: Boolean(source.capabilities.member_status_indicators), participation: Boolean(source.capabilities.cooperative_activities && source.capabilities.member_activity_participation),
    recruitment: Boolean(source.capabilities.membership_applications), referrals: Boolean(source.capabilities.member_referrals && source.capabilities.membership_applications && source.capabilities.payment_references !== false),
  };
  const result: AnalyticsResult = {
    generatedAt, filters, population: members.length,
    availability,
    breakdown: { membershipTypes: ["Associate", "True Member"].map(name => ({ name, count: members.filter(m => m.membershipType === name).length })), officialStatuses: ["Pending", "Active", "Inactive", "Suspended", "Terminated"].map(name => ({ name, count: members.filter(m => m.officialStatus === name).length })), previousTotal: priorMembers.length,
      previousNew: population(previousYear(filters.end)).filter(m => m.approved! >= previousYear(filters.start) && m.approved! <= previousYear(filters.end)).length,
      newTypes: ["Associate", "True Member"].map(name => ({ name, count: newMembers.filter(m => m.membershipType === name).length })) },
    options: { barangays: [...new Set([...NASUGBU_BARANGAYS, ...source.members.map(m => m.barangay?.trim()).filter((v): v is string => Boolean(v))])].sort((a, b) => a.localeCompare(b, "en", { numeric: true })), sectors: ANALYTICS_SECTORS },
    kpis: { total: members.length, newApprovals: newMembers.length, growth: rate(atEnd.length - before.length, before.length), baseline: before.length,
      participation90: source.capabilities.cooperative_activities && source.capabilities.member_activity_participation ? rate(participated90, mature90) : null, mature90, participated90,
      capitalCompletion: eligible.some(m => !m.capital.known) ? null : rate(completed.length, eligible.length), eligibleCapital: eligible.length, completedCapital: completed.length,
      attention: availability.engagement && availability.capital ? members.filter(attention).length : null, rfmAttention: members.filter(m => ["Needs Monitoring", "Inactive"].includes(m.engagement)).length, overdueCapital: members.filter(overdue).length },
    growth,
    engagement: { distribution: ENGAGEMENT_LABELS.map(name => ({ name, count: members.filter(m => m.engagement === name).length })),
      byLabel: ENGAGEMENT_LABELS.map(label => ({ label, dimensions: Array.from({ length: 5 }, (_, i) => { const rows = latestIndicators.filter(r => r.label === label); return { score: i + 1, recency: rows.filter(r => r.recencyScore === i + 1).length, frequency: rows.filter(r => r.frequencyScore === i + 1).length, contribution: rows.filter(r => r.contributionScore === i + 1).length }; }) })),
      dimensions: Array.from({ length: 5 }, (_, i) => ({ score: i + 1, recency: latestIndicators.filter(r => r.recencyScore === i + 1).length, frequency: latestIndicators.filter(r => r.frequencyScore === i + 1).length, contribution: latestIndicators.filter(r => r.contributionScore === i + 1).length })),
      scores: Array.from({ length: 13 }, (_, i) => ({ score: i + 3, count: latestIndicators.filter(r => r.score === i + 3).length })),
      lastComputedAt: latestIndicators.map(i => i.computedAt).sort().at(-1) ?? null, movement: movements, comparable, notComparable: members.length - comparable, cohorts },
    capital: { target: source.settings.target, maximum: source.settings.maximum, totalBalance: round(sum(members.filter(m => m.capital.known).map(m => m.capital.balance))),
      deadlineCategories: ["Completed", "Pending", "Due within 30 days", "Overdue", "Unknown deadline", "Unknown balance"].map(name => ({ name, count: members.filter(m => obligation(m) && deadlineCategory(m) === name).length })),
      monthly: monthList.map(month => ({ month, credits: round(sum(periodEntries.filter(e => e.date.startsWith(month) && e.direction === "Credit").map(e => e.amount))), interest: round(sum(periodEntries.filter(e => e.date.startsWith(month) && e.direction === "Credit" && isInterest(e)).map(e => e.amount))), deductions: round(sum(periodEntries.filter(e => e.date.startsWith(month) && e.direction === "Debit").map(e => e.amount))) })),
      previousCompletionRate: previousEligible.some(m => !m.capital.known) ? null : rate(previousEligible.filter(m => m.capital.balance >= source.settings.target).length, previousEligible.length),
      previousCompletions: members.filter(m => obligation(m) && completionDate(m) && completionDate(m)! >= previousYear(filters.start) && completionDate(m)! <= previousYear(filters.end)).length,
      stages: capitalStages.map(name => ({ name, count: members.filter(m => m.capital.stage === name).length })),
      contributions: round(sum(periodEntries.filter(e => e.direction === "Credit" && isCash(e)).map(e => e.amount))),
      interest: round(sum(periodEntries.filter(e => e.direction === "Credit" && isInterest(e)).map(e => e.amount))),
      otherCredits: round(sum(periodEntries.filter(e => e.direction === "Credit" && !isCash(e) && !isInterest(e)).map(e => e.amount))),
      deductions: round(sum(periodEntries.filter(e => e.direction === "Debit").map(e => e.amount))), overdue: members.filter(overdue).length,
      provisional: members.filter(m => m.membershipType === "Associate" && provisional(m)).length, reconciled: members.filter(m => m.capital.known).length, unknown: members.filter(m => !m.capital.known).length,
      completions: monthList.map(month => ({ month, count: members.filter(m => (m.membershipType === "True Member" || provisional(m)) && completionDate(m)?.startsWith(month) && completionDate(m)! >= filters.start && completionDate(m)! <= filters.end).length })), medianDays: stats.median, averageDays: stats.average },
    unassignedSectorCount: members.filter(m=>!m.selectedSectors?.length && !m.sector).length,
    sectors: ANALYTICS_SECTORS.map(name => ({ name, count: members.filter(m => (m.selectedSectors?.length ? m.selectedSectors : [m.sector]).includes(name)).length })), geography,
    sectorDetails: ANALYTICS_SECTORS.map(sector => { const rows = members.filter(m => (m.selectedSectors?.length ? m.selectedSectors : [m.sector]).includes(sector)), previous = priorMembers.filter(m => (m.selectedSectors?.length ? m.selectedSectors : [m.sector]).includes(sector)), sectorEligible = rows.filter(m => m.membershipType === "True Member"); const sectorComplete = sectorEligible.filter(m => m.capital.known && m.capital.balance >= source.settings.target); return { sector, members: rows.length, newApprovals: rows.filter(periodApproval).length, previousMembers: previous.length, change: rows.length - previous.length,
      engagement: ENGAGEMENT_LABELS.map(name => ({ name, count: rows.filter(m => m.engagement === name).length })), eligibleCapital: sectorEligible.length, completedCapital: sectorComplete.length, completionRate: sectorEligible.some(m => !m.capital.known) ? null : rate(sectorComplete.length, sectorEligible.length), recruitment: monthList.map(month => ({ month, count: rows.filter(m => periodApproval(m) && m.approved!.startsWith(month)).length })) }; }),
    recruitment: { monthly, yearly, bestMonth, bestQuarter, journey, applicationConversion: rate(journeyDates.filter(j => j.dates.has("Approved")).length, apps.length), approvedApplications: journeyDates.filter(j => j.dates.has("Approved")).length,
      journeyCohort: apps.length, incompleteHistory: journeyDates.filter(j => j.application.status !== "Submitted" && !j.dates.has(j.application.status)).length },
    referrals: { created: referrals.length, qualified: qualified.length, pending: referrals.filter(r => r.status === "Pending").length,
      topReferrers: [...grouped(referrals, r => r.referrerId)].map(([memberId, rows]) => { const member = members.find(m => m.id === memberId)!; return { memberId, memberCode: member.memberCode ?? member.id, fullName: member.fullName ?? "", created: rows.length, qualified: rows.filter(r => qualified.includes(r)).length }; }).sort((a, b) => b.qualified - a.qualified || b.created - a.created || a.memberCode.localeCompare(b.memberCode)),
      byBarangay: [...grouped(referrals, r => source.applications.find(a => a.id === r.applicationId)?.barangay ?? "Unspecified")].map(([barangay, rows]) => ({ barangay, created: rows.length, qualified: rows.filter(r => qualified.includes(r)).length })),
      bySector: ANALYTICS_SECTORS.map(name => ({ name, count: qualified.filter(r => source.applications.find(a => a.id === r.applicationId)?.sector === name).length })),
      rejected: referrals.filter(r => ["Rejected", "Cancelled"].includes(r.status)).length, conversion: rate(qualified.length, referrals.length),
      missingEvidence: referrals.filter(r => r.status === "Successful" && !qualified.includes(r)).length,
      byMonth: monthList.map(month => ({ month, created: referrals.filter(r => localDate(r.createdAt).startsWith(month)).length, qualified: qualified.filter(r => localDate(r.createdAt).startsWith(month)).length })) },
    insights: [],
    coverage: [
      { code: "CLASSIFICATION_HISTORY", message: "Barangay, primary sector, application source and approval eligibility use current records. Historical growth is a restated approval series; deleted/revoked approvals and unversioned classifications cannot be reconstructed." },
      { code: "LEDGER_BASIS", message: "Capital uses currently Posted credits minus debits by effective transaction date; reversals are debits. Historical balances are restated, not an audit-time reconstruction." },
      { code: "PARTICIPATION_COVERAGE", message: "Participation means recorded qualifying cooperative activity, using configured participation statuses. Unrecorded activity is unknown; zero means no qualifying record, not proof of no participation." },
      { code: "SECTOR_BASIS", message: "Members have one primary sector. Multi-select filters combine those sectors; assignments are not duplicated." },
      { code: "UNDATED_APPROVAL", message: "Approved records without an approval timestamp or explicit Approved application history are excluded from dated populations.", count: undated },
      { code: "RFM_COMPARABILITY", message: "Movement requires different snapshots with matching formula, settings fingerprint and calendar basis length. Legacy snapshots without fingerprints are not comparable.", count: members.length - comparable },
      { code: "CURRENT_POLICY", message: "Capital targets and qualifying-participation settings use current approved configuration. Historical policy changes and complete attendance recording coverage cannot be reconstructed." },
      { code: "CAPITAL_COVERAGE", message: "Unknown capital includes account/posted-ledger mismatches, validated payments missing ledger entries, negative balances, or incomplete sources. Such balances are excluded from reconciled totals and completion rates are unavailable when an eligible ledger is unknown.", count: members.filter(m => !m.capital.known).length },
      ...Object.entries(source.capabilities).filter(([, available]) => !available).map(([table]) => ({ code: `MISSING_${table}`, message: `${table} is unavailable or lacks required analytics columns. Related metrics have incomplete coverage; do not interpret missing evidence as zero.` })),
    ],
    definitions: [
      { metric: "Population", definition: "Distinct currently approved members with actual approval on/before the inclusive Manila as-of date; all selected dimensions applied." },
      { metric: "Growth", definition: "(Filtered population at reporting end − population before reporting start) ÷ population before reporting start × 100. N/A if base is zero." },
      { metric: "90-day participation", definition: "New approvals with a qualifying participation within 90 days ÷ new approvals with the full 90-day window observed. Reporting period defines the approval cohort." },
      { metric: "Capital completion", definition: "Reconciled eligible True Members at/above the configured required capital ÷ eligible True Members; unknown ledgers make the rate unavailable. Ordinary Associates excluded." },
      { metric: "Attention", definition: "Distinct union of RFM Needs Monitoring/Inactive and members with a confirmed capital obligation, recorded expired deadline and known balance below target. Unscored is separate." },
      { metric: "Referrals", definition: "Reporting-period referral creations by filtered referrers; qualification requires recorded Successful status, qualified date, approved linked member and validated required application payment evidence." },
      { metric: "Journey", definition: "Same reporting-period submission cohort throughout. Counts are observed milestones, not inferred funnel conversion. Durations are elapsed days from submission; history gaps disclosed." },
    ],
  };
  const observations: AnalyticsResult["insights"] = [
    { id: "attention", title: `${result.kpis.attention} members have an attention signal`, detail: `${result.kpis.rfmAttention} have monitoring/inactive RFM labels; ${result.kpis.overdueCapital} have recorded overdue capital as of ${filters.asOf}.`, formula: "Distinct union; a member with both signals counts once.", caveat: "Descriptive only. Does not change official membership status.", selection: { kind: "attention" } },
    { id: "unscored", title: `${members.length - latestIndicators.length} members are not yet scored`, detail: `No eligible persisted RFM snapshot on/before ${filters.asOf}.`, formula: "Filtered population minus members with an eligible RFM snapshot.", caveat: "Not Yet Scored is not Inactive. No recalculation is performed by this dashboard.", selection: { kind: "engagement", value: "Not Yet Scored" } },
    { id: "recruitment", title: bestMonth?.count ? `${bestMonth.month} led recorded recruitment` : "No approvals in this reporting period", detail: `${bestMonth?.count ?? 0} approvals in the strongest month of ${filters.start}–${filters.end}.`, formula: "Maximum monthly distinct approvals; earliest month wins a tie. Shown only with at least five approvals in the period.", caveat: "Partial months, small samples and missing approval dates limit comparisons. No statistical significance or forecast is implied.", selection: { kind: "month", value: bestMonth?.month } },
  ];
  result.insights = observations.filter(o => o.id === "attention" ? (result.kpis.attention ?? 0) > 0 && availability.engagement && availability.capital : o.id === "unscored" ? members.length > latestIndicators.length && availability.engagement : newMembers.length >= 5 && Boolean(bestMonth?.count));
  const approaching = result.capital.deadlineCategories.find(c => c.name === "Due within 30 days")?.count ?? 0;
  if (availability.capital && approaching) result.insights.push({ id: "deadlines", title: `${approaching} capital obligations are due within 30 days`, detail: `Confirmed obligations with recorded deadlines from ${filters.asOf} through ${addDays(filters.asOf, 30)}, below the configured ${source.settings.target} target.`, formula: "Distinct eligible members with a known reconciled balance below target and a recorded deadline in the next 30 days.", caveat: "The 30-day look-ahead is a descriptive reporting window. It does not create or extend an official deadline.", selection: { kind: "deadline", value: "Due within 30 days" } });
  function matchingIds(selection: AnalyticsSelection = {}) {
    return members.filter(m => {
      switch (selection.kind) {
        case "attention": return attention(m);
        case "new": return periodApproval(m);
        case "overdue": return overdue(m);
        case "deadline": return obligation(m) && deadlineCategory(m) === selection.value;
        case "engagement": return m.engagement === selection.value;
        case "capital": return m.capital.stage === selection.value;
        case "sector": return m.sector === selection.value;
        case "month": return m.approved!.startsWith(selection.value ?? "!");
        case "barangay": return normalizeBarangay(m.barangay || "Unspecified") === normalizeBarangay(selection.value ?? "") && (!selection.sector || m.sector === selection.sector);
        default: return true;
      }
    }).map(m => m.id);
  }
  return { result, matchingIds };
}
