"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type RefObject } from "react";
import { X } from "lucide-react";
import { activeChips, downloadFinancialAnalytics, type FinancialAnalyticsResult, type FinancialFilters } from "./financial-analytics-client";
import { categoryLabels } from "./FinancialFilters";
import {
  BridgeView, ContributionView, ExpenseView, IncomeView, IntegrityView, MethodologyView, OperationalView, PeriodView, SeasonalityView,
} from "./FinancialDrawerViews";
import { SourceCategoryMatrixDrawer } from "./SourceCategoryMatrixDrawer";
import styles from "./FinancialAnalytics.module.css";

export type FinancialOverlay = {
  kind: "income" | "expense" | "bridge" | "period" | "sources" | "category" | "operational" | "seasonality" | "integrity" | "methodology" | "matrix";
  value?: string;
  window?: { from: string; to: string; label: string };
} | null;

const titles: Record<Exclude<FinancialOverlay, null>["kind"], string> = {
  income: "Income details", expense: "Expense driver details", bridge: "Net surplus change analysis", period: "Financial performance details",
  sources: "Income source details", category: "Financial category details", operational: "Source contribution", seasonality: "Financial seasonality",
  integrity: "Financial data integrity", methodology: "Definitions, limits and rules", matrix: "Compare sources & categories",
};

export function FinancialDrawer({ overlay, data, applied, today, onClose, returnFocus }: {
  overlay: Exclude<FinancialOverlay, null>; data: FinancialAnalyticsResult; applied: FinancialFilters; today: string; onClose: () => void; returnFocus: RefObject<HTMLElement | null>;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const labels = categoryLabels(data.options.categories);
  const chips = activeChips(applied, id => labels.get(id) ?? `#${id}`).map(chip => chip.label);
  const scope = overlay.kind === "period" ? "period" : overlay.kind === "matrix" ? "matrix" : "full";
  const subject = overlay.kind === "period" && overlay.window ? overlay.window.label : data.periodLabel;
  const exportable = overlay.kind !== "matrix" && overlay.kind !== "methodology";
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={`${styles.drawer} ${overlay.kind === "matrix" ? styles.left : ""}`} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
      <header className={styles.drawerHeader}>
        <div><Dialog.Title>{titles[overlay.kind]}</Dialog.Title><Dialog.Description>{subject}{data.comparison.enabled && overlay.kind !== "period" ? ` · compared with ${data.comparisonLabel}` : ""}</Dialog.Description></div>
        <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-md border border-coop-border bg-white" aria-label="Close details"><X className="size-5" /></Dialog.Close>
      </header>
      <div className={styles.drawerBody}>
        <p className="text-xs text-coop-muted">Active filters: {[data.filters.recordType === "all" ? "" : `Type: ${data.filters.recordType}`, ...chips.filter(label => !label.startsWith("Type:"))].filter(Boolean).join(" · ") || "All eligible operating records"}</p>
        {exportable && <div><button type="button" disabled={exporting} className={styles.textAction} onClick={async () => { setExporting(true); setExportError(""); try { await downloadFinancialAnalytics(applied, scope, overlay.window); } catch (error) { setExportError(error instanceof Error ? error.message : "Export failed."); } finally { setExporting(false); } }}>{exporting ? "Preparing export…" : scope === "period" ? "Export this period (Excel)" : "Export complete filtered report (Excel)"}</button>{exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}</div>}
        {overlay.kind === "income" && <IncomeView data={data} />}
        {overlay.kind === "expense" && <ExpenseView data={data} />}
        {overlay.kind === "bridge" && <BridgeView data={data} />}
        {overlay.kind === "period" && <PeriodView data={data} applied={applied} window={overlay.window} />}
        {overlay.kind === "category" && !overlay.value && <IncomeView data={data} />}
        {(overlay.kind === "sources" || (overlay.kind === "category" && overlay.value)) && <ContributionView data={data} applied={applied} value={overlay.value} />}
        {overlay.kind === "operational" && <OperationalView data={data} value={overlay.value} />}
        {overlay.kind === "seasonality" && <SeasonalityView data={data} />}
        {overlay.kind === "integrity" && <IntegrityView data={data} value={overlay.value} />}
        {overlay.kind === "methodology" && <MethodologyView data={data} />}
        {overlay.kind === "matrix" && <SourceCategoryMatrixDrawer applied={applied} today={today} />}
      </div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
