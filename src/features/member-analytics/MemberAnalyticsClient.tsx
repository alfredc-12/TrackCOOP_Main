"use client";
import { MonthlyCapitalCompletion } from "@/features/membership/MonthlyCapitalCompletion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, ArrowUpRight, BadgeCheck, ChartColumnIncreasing, CircleCheck, CircleHelp, Download, Handshake, Info, Leaf, Lightbulb, MapPinned, Minus, RefreshCw, ShieldAlert, TrendingDown, TrendingUp, UsersRound, UserRoundCheck, WalletCards, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/Button";
import { AnalyticsFilterForm } from "./AnalyticsFilters";
import { AnalyticsDrawer, type AnalyticsOverlay } from "./AnalyticsDrawer";
import { analyticsMemberLink, analyticsParams, downloadAnalytics, filtersFromParams, formatNumber as n, getMemberAnalytics, percent, peso, type AnalyticsFilters, type AnalyticsResult, type AnalyticsSelection } from "./analytics-client";
import styles from "./MemberAnalytics.module.css";
import { AnalyticsSignal, AnalyticsStatus, signalIcons } from "./AnalyticsSignal";
import { attentionSignal, completionSignal, growthSignal, signalColors, statusTone, type AnalyticsTone } from "./analytics-signals";

const DemographicsMap = dynamic(() => import("@/app/(portal)/chairman/dashboard/_components/DemographicsMap"), { ssr: false, loading: () => <p className="p-8 text-sm" role="status">Loading geographic view…</p> });
const chartColors = [signalColors.good, signalColors.warning, signalColors.danger, signalColors.neutral];
const capitalShortLabels: Record<string, string> = {
  "Zero balance": "Zero", "Below required": "Below target", "Required to maximum": "Target met",
  "At maximum": "At max", "Above maximum": "Over max", "Unknown ledger": "Unknown",
};
function Panel({ title, description, action, children, available = true, icon: Icon, tone = "neutral" }: { title: string; description: string; action?: ReactNode; children: ReactNode; available?: boolean; icon?: LucideIcon; tone?: AnalyticsTone }) {
  return <section className={styles.panel}><header className={styles.panelHeader}><div className={styles.panelHeading}>{Icon && <span className={styles.sectionIcon} data-tone={tone}><Icon aria-hidden="true" className="size-5" /></span>}<div><h2>{title}</h2><p>{description}</p></div></div>{action}</header><div className={styles.body}>{available ? children : <p className={styles.notice}>This analysis is unavailable because a required source table is missing. Open Definitions & coverage for the exact source gap. Missing data is not zero.</p>}</div></section>;
}
function InsightRow({ insight, tone, action }: { insight: AnalyticsResult["insights"][number]; tone: AnalyticsTone; action: ReactNode }) {
  const Icon = signalIcons[tone];
  return <article className={styles.insight}><div className={styles.insightHeading}><span className={styles.insightIcon} data-tone={tone}><Icon aria-hidden="true" className="size-4" /></span><div className="min-w-0"><h3>{insight.title}</h3><p>{insight.detail}</p><p className="text-coop-muted">{insight.formula} {insight.caveat}</p></div></div>{action}</article>;
}
export function MemberAnalyticsClient({ today }: { today: string }) {
  const params = useSearchParams();
  return <AnalyticsWorkspace key={params.toString()} today={today} initial={filtersFromParams(new URLSearchParams(params.toString()), today)} />;
}
function AnalyticsWorkspace({ today, initial }: { today: string; initial: AnalyticsFilters }) {
  const router = useRouter(), pathname = usePathname();
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [overlay, setOverlay] = useState<AnalyticsOverlay>(null);
  const [interval, setInterval] = useState("Monthly");
  const [mapHighlight, setMapHighlight] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const [applied] = useState(initial);
  useEffect(() => {
    const controller = new AbortController();
    getMemberAnalytics(applied, controller.signal).then(report => { if (!controller.signal.aborted) { setData(report); setError(""); } }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Analytics could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, refresh]);
  const open = (kind: Exclude<AnalyticsOverlay, null>["kind"], element: HTMLElement, value?: string) => { returnFocus.current = element; setOverlay({ kind, value }); };
  const action = (label: string, kind: Exclude<AnalyticsOverlay, null>["kind"], value?: string, accessibleLabel?: string) => <button type="button" aria-label={accessibleLabel} className={styles.textAction} onClick={e => open(kind, e.currentTarget, value)}>{label}<ArrowUpRight className="size-4" aria-hidden="true" /></button>;
  const chartOpen = (kind: Exclude<AnalyticsOverlay, null>["kind"], value?: string) => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOverlay({ kind, value }); };
  const management = (label: string, selection: AnalyticsSelection = {}) => <Link className={styles.textAction} href={analyticsMemberLink(applied, selection)}>{label}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>;
  const exportReport = async () => { setExporting(true); try { await downloadAnalytics(applied); } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); } finally { setExporting(false); } };
  const groupedGrowth = new Map<string, AnalyticsResult["growth"][number]>();
  for (const g of data?.growth ?? []) {
    const key = interval === "Yearly" ? g.month.slice(0, 4) : interval === "Quarterly" ? `${g.month.slice(0, 4)} Q${Math.ceil(Number(g.month.slice(5, 7)) / 3)}` : g.month;
    const current = groupedGrowth.get(key);
    groupedGrowth.set(key, { month: key, newMembers: (current?.newMembers ?? 0) + g.newMembers, previousNew: (current?.previousNew ?? 0) + g.previousNew, cumulative: g.cumulative, associates: (current?.associates ?? 0) + g.associates, trueMembers: (current?.trueMembers ?? 0) + g.trueMembers });
  }
  const kpis = data ? [
    { title: "Approved members", value: n(data.kpis.total), note: `As of ${applied.asOf}; previous year ${n(data.breakdown.previousTotal)}`, kind: "growth" as const, icon: UsersRound, signal: { tone: data.kpis.total ? "good" as const : "neutral" as const, label: data.kpis.total ? "Approved" : "None recorded" } },
    { title: "New approvals", value: n(data.kpis.newApprovals), note: `In period; previous year ${n(data.breakdown.previousNew)}`, kind: "growth" as const, icon: UserRoundCheck, signal: { tone: !data.kpis.newApprovals ? "neutral" as const : data.kpis.newApprovals < data.breakdown.previousNew ? "warning" as const : "good" as const, label: !data.kpis.newApprovals ? "None recorded" : data.kpis.newApprovals < data.breakdown.previousNew ? "Below prior year" : "New approvals" } },
    { title: "Membership growth", value: percent(data.kpis.growth), note: `${n(data.kpis.baseline)} members before start`, kind: "growth" as const, icon: data.kpis.growth === null ? CircleHelp : data.kpis.growth < 0 ? TrendingDown : data.kpis.growth === 0 ? Minus : TrendingUp, signal: growthSignal(data.kpis.growth) },
    { title: "First 90-day participation", value: percent(data.kpis.participation90), note: `${n(data.kpis.participated90)} of ${n(data.kpis.mature90)} mature new members`, kind: "engagement" as const, icon: data.kpis.participation90 === null ? CircleHelp : Activity, signal: completionSignal(data.kpis.participation90, "All recorded") },
    { title: "True Member capital complete", value: percent(data.kpis.capitalCompletion), note: `${n(data.kpis.completedCapital)} of ${n(data.kpis.eligibleCapital)} eligible`, kind: "capital" as const, icon: data.kpis.capitalCompletion === null ? CircleHelp : data.kpis.capitalCompletion === 100 ? BadgeCheck : WalletCards, signal: completionSignal(data.kpis.capitalCompletion) },
    { title: "Members needing attention", value: n(data.kpis.attention), note: "RFM signals or recorded overdue capital", kind: "attention" as const, icon: data.kpis.attention === null ? CircleHelp : data.kpis.attention === 0 ? CircleCheck : ShieldAlert, signal: attentionSignal(data.kpis.attention, data.kpis.overdueCapital, data.engagement.distribution.find(s => s.name === "Inactive")?.count ?? 0) },
  ] : [];
  return <div className={styles.dashboard}>
    <PageHeader eyebrow="Chairman · Member analytics" title="Member analytics" description="Growth, participation and capital health from recorded cooperative activity." actions={<><Button variant="secondary" size="sm" disabled={loading} onClick={() => { setLoading(true); setRefresh(v => v + 1); }}><RefreshCw className="size-4" aria-hidden="true" />Refresh</Button><Button variant="secondary" size="sm" disabled={!data || loading} loading={exporting} onClick={() => void exportReport()}><Download className="size-4" aria-hidden="true" />Export Excel</Button></>} />
    <AnalyticsFilterForm applied={applied} today={today} barangays={data?.options.barangays ?? []} loading={loading} onApply={next => router.push(`${pathname}?${analyticsParams(next)}`, { scroll: false })} />
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><Button variant="secondary" size="sm" onClick={() => { setLoading(true); setRefresh(v => v + 1); }}>Retry analytics</Button></div>}
    {loading && <p role="status" className={styles.notice}>Loading filtered analytics…</p>}
    {data && <>
      <MonthlyCapitalCompletion start={applied.start} end={applied.end} sectors={applied.sectors} barangays={applied.barangays} membershipType={applied.membershipType}/>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-coop-muted" aria-live="polite"><p><strong>{n(data.population)} matching approved members</strong> · {applied.start}–{applied.end} · as of {applied.asOf}</p><button className={styles.textAction} onClick={e => open("methodology", e.currentTarget)}><Info className="size-4" aria-hidden="true" />Definitions & coverage</button></div>
      {!data.population && <p className={styles.notice}>No members match these filters. Charts retain their structure; rates with no eligible denominator show N/A. Clear filters to broaden the view.</p>}
      <div className={styles.statusLegend} role="group" aria-label="Analytics color meanings"><AnalyticsSignal tone="good" label="Positive / complete" /><AnalyticsSignal tone="warning" label="Monitor / partial" /><AnalyticsSignal tone="danger" label="Attention / exception" /><AnalyticsSignal tone="neutral" label="No data / context" /></div>
      <section className={styles.kpis} aria-label="Membership performance KPIs">{kpis.map(k => { const Icon = k.icon; return <button type="button" key={k.title} className={`${styles.panel} ${styles.kpi}`} data-tone={k.signal.tone} title={`${k.title}. ${k.note}. Open details for the formula and coverage.`} onClick={e => open(k.kind, e.currentTarget)}><span className={styles.kpiHeading}><span className={styles.kpiLabel}>{k.title}</span><span className={styles.kpiIcon}><Icon aria-hidden="true" className="size-4" /></span></span><strong>{k.value}</strong><AnalyticsSignal {...k.signal} /><small>{k.note}</small></button>; })}</section>
      <div className={styles.twoColumns}>
        <Panel icon={TrendingUp} tone={growthSignal(data.kpis.growth).tone} title="Membership growth" description="Approvals in period and cumulative membership" action={action("Details", "growth")}>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Growth interval">{["Monthly", "Quarterly", "Yearly"].map(v => <button className={styles.tab} key={v} aria-pressed={interval === v} onClick={() => setInterval(v)}>{v}</button>)}</div>
          <div className={`${styles.chart} ${styles.compactChart}`} role="img" aria-label="New approvals, cumulative members, and previous-year approvals by period"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...groupedGrowth.values()]} margin={{ top: 10, right: 8, left: -20, bottom: 5 }}><CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={24} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar isAnimationActive={false} dataKey="newMembers" name="New approvals" onClick={row => chartOpen("growth", String(row.payload?.month ?? ""))} fill={chartColors[0]} radius={[3, 3, 0, 0]} /><Line isAnimationActive={false} dataKey="cumulative" name="Cumulative members" stroke="#123d2a" dot={false} strokeWidth={2} /><Line isAnimationActive={false} dataKey="previousNew" name="Previous year approvals" stroke="#a67921" dot={false} strokeDasharray="4 4" /></ComposedChart></ResponsiveContainer></div>
          <div className={styles.chartFooter}><div className={styles.compactLegend} aria-label="Growth chart legend"><span className={styles.seriesKey}><i style={{ background: chartColors[0] }} />New approvals</span><span className={styles.seriesKey}><i className={styles.lineSwatch} />Cumulative</span><span className={styles.seriesKey}><i className={styles.comparisonSwatch} />Prior year</span></div>{management("View new approvals", { kind: "new" })}</div>
        </Panel>
        <Panel icon={Activity} available={data.availability.engagement} title="Member engagement" description="Latest persisted RFM labels · official status stays separate" action={action("Details", "engagement")}>
          <div className={styles.engagementOverview}><div className={styles.engagementDonut} role="img" aria-label={data.engagement.distribution.map(r => `${r.name}: ${r.count}`).join(", ")}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={data.engagement.distribution} dataKey="count" nameKey="name" innerRadius="57%" outerRadius="85%" paddingAngle={1} onClick={row => chartOpen("engagement", String(row.name))}>{data.engagement.distribution.map((r, i) => <Cell key={r.name} fill={chartColors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className={styles.engagementLegend}>{data.engagement.distribution.map((r, i) => <button type="button" key={r.name} onClick={e => open("engagement", e.currentTarget, r.name)} ><AnalyticsStatus label={r.name} /><strong className="tabular-nums" style={{ color: i === 1 ? "var(--coop-warning, #8a6200)" : chartColors[i] }}>{n(r.count)} <small className="font-normal text-coop-muted">{percent(data.population ? r.count / data.population * 100 : null)}</small></strong></button>)}</div></div>
          <p className={styles.compactNote}>{n(data.population - (data.engagement.distribution.find(r => r.name === "Not Yet Scored")?.count ?? 0))} of {n(data.population)} scored; updated {data.engagement.lastComputedAt ? new Date(data.engagement.lastComputedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) : "not available"}.</p><div className={`${styles.summary} ${styles.compactSummary}`}><p>Movement: <strong>{n(data.engagement.comparable)} comparable</strong></p>{action("30 / 60 / 90-day cohorts", "engagement", "cohorts", "View 30 / 60 / 90-day cohorts")}</div>
        </Panel>
      </div>
      <div className={styles.twoColumns}>
        <Panel icon={WalletCards} tone={data.capital.overdue ? "danger" : "neutral"} available={data.availability.capital} title="Share-capital health" description={`True Member target ${peso(data.capital.target)} · maximum ${peso(data.capital.maximum)}`} action={action("Details", "capital")}>
          <p className="mb-4 text-sm text-coop-muted">Reconciled balances <strong className="ml-2 text-xl text-coop-forest">{peso(data.capital.totalBalance)}</strong></p>
          <div className={`${styles.chart} ${styles.compactChart}`} role="img" aria-label="Members by capital stage"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.capital.stages} layout="vertical" margin={{ left: 10, right: 20 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 11 }} /><Tooltip formatter={value => [`${n(Number(value))} (${percent(data.population ? Number(value) / data.population * 100 : null)})`, "Members"]} /><Bar isAnimationActive={false} dataKey="count" name="Members" onClick={row => chartOpen("capital", String(row.payload?.name ?? ""))} fill={chartColors[0]} radius={[0, 3, 3, 0]}>{data.capital.stages.map(s => <Cell key={s.name} fill={signalColors[statusTone(s.name) ?? "neutral"]} />)}</Bar></BarChart></ResponsiveContainer></div>
          <div className={styles.compactLegend} aria-label="Capital stage summary">{data.capital.stages.filter(s => s.count > 0).map(s => <button key={s.name} type="button" className={styles.compactKey} title={`${s.name}: ${n(s.count)} (${percent(data.population ? s.count / data.population * 100 : null)})`} aria-label={`View ${s.name}: ${n(s.count)} members (${percent(data.population ? s.count / data.population * 100 : null)})`} onClick={e => open("capital", e.currentTarget, s.name)}><i aria-hidden="true" style={{ background: signalColors[statusTone(s.name) ?? "neutral"] }} />{capitalShortLabels[s.name] ?? s.name} <strong>{n(s.count)}</strong></button>)}</div><p className={styles.compactNote}>Target applies to eligible members. All stages and percentages in Details.</p><div className={`${styles.summary} ${styles.compactSummary}`}><AnalyticsSignal tone={data.capital.overdue ? "danger" : "good"} label={`${n(data.capital.overdue)} overdue`} />{data.capital.unknown > 0 && <AnalyticsSignal tone="neutral" label={`${n(data.capital.unknown)} unknown`} />}<p>Period credits <strong>{peso(data.capital.contributions + data.capital.interest + data.capital.otherCredits)}</strong></p></div>
        </Panel>
        <Panel icon={Leaf} tone="good" title="Agricultural sectors" description="Members by selected agricultural sector" action={action("Details", "sector")}>
          <div className={styles.chart} role="img" aria-label="Membership by agricultural sector"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={data.sectors.map(s => ({ ...s, shortName: s.name === "High-value crops (gulayan)" ? "High-Value Crops" : s.name }))} margin={{ left: 4, right: 24 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="shortName" width={125} tick={{ fontSize: 12 }} /><Tooltip formatter={value => [`${n(Number(value))} (${percent(data.population ? Number(value) / data.population * 100 : null)})`, "Members"]} /><Bar isAnimationActive={false} dataKey="count" name="Members" onClick={row => chartOpen("sector", String(row.payload?.name ?? ""))} fill="#4d8f5b" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
          <div className={styles.compactLegend} aria-label="Sector summary">{data.sectors.filter(s => s.count > 0).map(s => <button key={s.name} type="button" className={styles.compactKey} title={`${s.name}: ${n(s.count)} (${percent(data.population ? s.count / data.population * 100 : null)})`} aria-label={`View ${s.name}: ${n(s.count)} members (${percent(data.population ? s.count / data.population * 100 : null)})`} onClick={e => open("sector", e.currentTarget, s.name)}>{s.name === "High-value crops (gulayan)" ? "High-value" : s.name} <strong>{n(s.count)}</strong></button>)}</div><div className={`${styles.summary} ${styles.compactSummary}`}><p>{n(data.unassignedSectorCount ?? Math.max(0, data.population - data.sectors.reduce((v, s) => v + s.count, 0)))} without a selected sector</p></div>
        </Panel>
      </div>
      <Panel icon={MapPinned} title="Members across Batangas" description="Recorded membership across all Batangas barangay boundaries" action={action("Compare Barangays & Sectors", "matrix")}>
        <DemographicsMap demographics={(data.mapGeography ?? data.geography).map(g => ({ ...g, sectorCounts: Object.entries(g.sectorCounts).map(([sector, count]) => ({ sector, count })) }))} analytics={data.mapGeography ?? data.geography} memberLink={barangay => analyticsMemberLink(applied, { kind: "barangay", value: barangay })} highlightBarangay={mapHighlight} />
      </Panel>
      <div className={styles.twoColumns}>
        <Panel icon={ChartColumnIncreasing} tone="good" available={data.availability.recruitment} title="Recruitment performance" description="Actual approvals · strongest recorded periods" action={action("Details & journey", "recruitment")}>
          <div className={styles.chart} role="img" aria-label="Monthly approvals"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.recruitment.monthly} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={24} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar isAnimationActive={false} dataKey="count" name="Approved members" onClick={row => chartOpen("recruitment", String(row.payload?.month ?? ""))} fill="#1f6b43" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><div className={styles.summary}><p>Strongest month: <strong>{data.recruitment.bestMonth?.month ?? "N/A"}</strong></p><p>Strongest 3 months: <strong>{data.recruitment.bestQuarter ? `${data.recruitment.bestQuarter.start}–${data.recruitment.bestQuarter.end}` : "N/A"}</strong></p></div>
        </Panel>
        <Panel icon={Handshake} available={data.availability.referrals} title="Member referrals" description="Reporting-period referrals by the filtered member population" action={action("Details", "referrals")}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 py-6">{[
            { label: "Referrals created", value: n(data.referrals.created), tone: "neutral" as const, icon: Handshake },
            { label: "Qualified", value: n(data.referrals.qualified), tone: "good" as const, icon: CircleCheck },
            { label: "Pending", value: n(data.referrals.pending), tone: data.referrals.pending ? "warning" as const : "neutral" as const, icon: signalIcons.warning },
            { label: "Creation-cohort conversion", value: percent(data.referrals.conversion), tone: completionSignal(data.referrals.conversion).tone, icon: data.referrals.conversion === null ? CircleHelp : UserRoundCheck },
          ].map(({ label, value, tone, icon: Icon }) => <div key={label}><p className="flex items-center gap-2 text-xs text-coop-muted"><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</p><p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: tone === "warning" ? "var(--coop-warning, #8a6200)" : signalColors[tone] }}>{value}</p></div>)}</div><p className={styles.notice}>Qualification needs approval and validated required payment evidence. {n(data.referrals.missingEvidence)} successful records lack complete supporting evidence.</p>
        </Panel>
      </div>
      <Panel icon={Lightbulb} tone="warning" title="What the records show" description="Descriptive observations · no predictions or automatic status changes" action={action("Methodology", "methodology")}>
        {!data.insights.length && <p className={styles.notice}>No observations meet the reporting rules for this selection. Counts remain available in the charts; no conclusions are inferred from insufficient data.</p>}{data.insights.map(insight => <InsightRow key={insight.id} insight={insight} tone={insight.id === "attention" ? attentionSignal(data.kpis.attention, data.kpis.overdueCapital, data.engagement.distribution.find(s => s.name === "Inactive")?.count ?? 0).tone : insight.id === "unscored" ? "neutral" : insight.id === "deadlines" ? "warning" : "good"} action={management("View members", insight.selection)} />)}
      </Panel>
      <p className="text-xs leading-6 text-coop-muted">Updated {new Date(data.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · Historic classifications and ledgers are restated from available records. Open Definitions & coverage before comparing incomplete histories.</p>
      {overlay && <AnalyticsDrawer key={overlay.kind} overlay={overlay} data={data} onClose={() => setOverlay(null)} returnFocus={returnFocus} onChoose={barangay => setMapHighlight(barangay)} />}
    </>}
  </div>;
}
