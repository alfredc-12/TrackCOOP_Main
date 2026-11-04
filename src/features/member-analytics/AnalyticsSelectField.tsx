import { useId } from "react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import styles from "./MemberAnalytics.module.css";

/** Labels are presentation only; empty/all filters still send an empty API value. */
export function AnalyticsSelectField({ label, value, options, allLabel, onChange }: {
  label: string; value: string; options: string[]; allLabel?: string; onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <StyledSelect id={id} aria-label={label} value={value || allLabel || ""} options={allLabel ? [allLabel, ...options] : options} onChange={next => onChange(next === allLabel ? "" : next)} />
  </div>;
}
