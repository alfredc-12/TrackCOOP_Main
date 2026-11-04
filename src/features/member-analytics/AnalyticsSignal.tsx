import { CircleCheck, CircleHelp, Clock3, TriangleAlert } from "lucide-react";
import { statusTone, type AnalyticsTone } from "./analytics-signals";
import styles from "./MemberAnalytics.module.css";

export const signalIcons = { good: CircleCheck, warning: Clock3, danger: TriangleAlert, neutral: CircleHelp };

export function AnalyticsSignal({ tone, label }: { tone: AnalyticsTone; label: string }) {
  const Icon = signalIcons[tone];
  return <span className={styles.signalBadge} data-tone={tone}><Icon aria-hidden="true" className="size-3.5 shrink-0" />{label}</span>;
}

export function AnalyticsStatus({ label }: { label: string }) {
  const tone = statusTone(label);
  return tone ? <AnalyticsSignal tone={tone} label={label} /> : label;
}
