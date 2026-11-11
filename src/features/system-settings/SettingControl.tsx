"use client";
import { useId, useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { describeValue, object, type SettingEntry } from "./settings-client";
import styles from "./SystemPages.module.css";
const number = (text: string) => (text === "" ? null : Number(text));
export function SettingControl({
  setting: s,
  value,
  onChange,
  statuses,
}: {
  setting: SettingEntry;
  value: unknown;
  onChange: (v: unknown) => void;
  statuses: string[];
}) {
  const id = useId();
  const [newCrop, setNewCrop] = useState("");
  const r = object(value);
  const numeric = (
    label: string,
    v: unknown,
    set: (v: unknown) => void,
    step = "1",
  ) => (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min="0"
        step={step}
        value={typeof v === "number" ? v : ""}
        onChange={(e) => set(number(e.target.value))}
      />
    </label>
  );
  const toggle = (label: string, v: unknown, set: (v: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(v)}
      aria-label={label}
      className={styles.switch}
      data-checked={Boolean(v)}
      onClick={() => set(!v)}
    >
      <span className={styles.switchTrack}>
        <span>
          {Boolean(v) && <Check className="size-3" aria-hidden="true" />}
        </span>
      </span>
      <strong>{v ? "Enabled" : "Disabled"}</strong>
    </button>
  );
  if (!s.editable)
    return (
      <div className={styles.readOnly}>
        <strong>
          {s.category === "inventory"
            ? "Stock deductions above availability are blocked"
            : describeValue(value) + (s.unit ? " " + s.unit : "")}
        </strong>
        <span className={styles.hint}>
          View-only policy
          {s.enforced !== undefined && s.category !== "inventory"
            ? ` · fixed workflow value: ${describeValue(s.enforced)} ${s.unit ?? ""}`
            : ""}
        </span>
        {s.enforced !== undefined &&
          JSON.stringify(s.enforced) !== JSON.stringify(value) && (
            <span className={styles.warning}>
              Stored setting differs from system enforcement. No policy is
              changed here.
            </span>
          )}
      </div>
    );
  if (s.kind === "boolean") return toggle(s.label, value, onChange);
  if (s.kind === "number")
    return numeric(
      `${s.label}${s.unit ? ` (${s.unit})` : ""}`,
      value,
      onChange,
      s.unit === "PHP" ? "0.01" : "1",
    );
  if (s.kind === "text")
    return (
      <label className={styles.field}>
        <span className="sr-only">{s.label}</span>
        <input
          id={id}
          aria-label={s.label}
          value={typeof value === "string" ? value : ""}
          maxLength={40}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  if (s.kind === "referral")
    return (
      <div className={styles.fields}>
        {toggle("Enable referral rewards", r.enabled, (v) =>
          onChange({ ...r, enabled: v }),
        )}
        {numeric(
          "Credits per successful referral",
          r.creditsPerSuccessfulReferral,
          (v) => onChange({ ...r, creditsPerSuccessfulReferral: v }),
        )}
        <label className={styles.field}>
          <span>Reward label</span>
          <input
            aria-label="Reward label"
            maxLength={80}
            value={String(r.label ?? "")}
            onChange={(e) => onChange({ ...r, label: e.target.value })}
          />
        </label>
      </div>
    );
  if (s.kind === "labels")
    return (
      <div className={styles.fields}>
        {numeric("Active minimum total score", r.activeMin, (v) =>
          onChange({ ...r, activeMin: v }),
        )}
        {numeric(
          "Needs Monitoring minimum total score",
          r.needsMonitoringMin,
          (v) => onChange({ ...r, needsMonitoringMin: v }),
        )}
        <p className={styles.hint}>
          Engagement labels do not change official membership status.
        </p>
      </div>
    );
  if (s.kind === "statuses") {
    const selected = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === "string")
        : [],
      available = statuses.filter((v) => !selected.includes(v));
    return (
      <div>
        <div className={styles.chips}>
          {selected.map((v) => (
            <button
              type="button"
              className={styles.chip}
              key={v}
              aria-label={`Remove status ${v}`}
              onClick={() => onChange(selected.filter((s) => s !== v))}
            >
              {v}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
        {available.length > 0 && (
          <div className="mt-3">
            <StyledSelect
              aria-label="Add a participation status"
              prefix="Add status"
              value="Choose a recorded status"
              options={["Choose a recorded status", ...available]}
              onChange={(v) => {
                if (available.includes(v)) onChange([...selected, v]);
              }}
            />
          </div>
        )}
      </div>
    );
  }
  if (s.kind === "crop_list") {
    const selected = Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string")
      : [];
    const normalizedNewCrop = newCrop.trim().toLowerCase();
    const canAdd = Boolean(
      newCrop.trim() &&
        newCrop.trim().length <= 80 &&
        !selected.some((crop) => crop.trim().toLowerCase() === normalizedNewCrop) &&
        selected.length < 64,
    );
    return (
      <div>
        <div className={styles.chips} aria-label="Configured High-Value Crops">
          {selected.map((crop) => (
            <button
              key={crop}
              type="button"
              className={styles.chip}
              aria-label={`Remove High-Value Crop ${crop}`}
              onClick={() => onChange(selected.filter((item) => item !== crop))}
            >
              {crop}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className={`${styles.field} min-w-[min(100%,18rem)] flex-1`}>
            <span>Add crop name</span>
            <input
              aria-label="Add High-Value Crop name"
              value={newCrop}
              maxLength={80}
              placeholder="e.g. Tomato"
              onChange={(event) => setNewCrop(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canAdd) {
                  event.preventDefault();
                  onChange([...selected, newCrop.trim()]);
                  setNewCrop("");
                }
              }}
            />
          </label>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-coop-control border border-coop-border bg-coop-surface px-4 text-sm font-semibold text-coop-forest transition hover:bg-coop-subtle disabled:pointer-events-none disabled:opacity-50"
            disabled={!canAdd}
            onClick={() => {
              onChange([...selected, newCrop.trim()]);
              setNewCrop("");
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add crop
          </button>
        </div>
        <p className={`${styles.hint} mt-2`}>
          Remove a chip to exclude it. Changes apply to new Inventory and Seasonal Analytics loads after saving.
        </p>
      </div>
    );
  }
  const axes = [
    ["recencyDays", "Recent activity", "Maximum days", "max"],
    ["frequencyCount", "Participation", "Minimum count", "min"],
    ["contributionAmount", "Capital contribution", "Minimum PHP", "min"],
  ];
  return (
    <div className={styles.thresholdGrid}>
      {axes.map(([key, title, boundary, field]) => {
        const rows = Array.isArray(r[key]) ? (r[key] as unknown[]) : [];
        const update = (index: number, name: string, v: unknown) =>
          onChange({
            ...r,
            [key]: rows.map((row, i) =>
              i === index ? { ...object(row), [name]: v } : row,
            ),
          });
        return (
          <section key={key}>
            <h4>{title}</h4>
            <div className={styles.thresholdRows}>
              <span className={styles.hint}>{boundary}</span>
              <span className={styles.hint}>Score</span>
              <span aria-hidden="true" />
              {rows.map((row, i) => {
                const data = object(row);
                return (
                  <div key={i} className={styles.thresholdRow}>
                    {numeric(
                      `${title} row ${i + 1} ${boundary.toLowerCase()}`,
                      data[field],
                      (v) => update(i, field, v),
                      key === "contributionAmount" ? "0.01" : "1",
                    )}
                    <StyledSelect
                      aria-label={`${title} row ${i + 1} score`}
                      value={String(data.score)}
                      options={["1", "2", "3", "4", "5"]}
                      onChange={(v) => update(i, "score", Number(v))}
                    />
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={rows.length <= 1}
                      aria-label={`Remove ${title.toLowerCase()} threshold ${i + 1}`}
                      onClick={() =>
                        onChange({
                          ...r,
                          [key]: rows.filter((_row, index) => index !== i),
                        })
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className={`${styles.actions} ${styles.addThreshold}`}
              disabled={rows.length >= 64}
              onClick={() =>
                onChange({
                  ...r,
                  [key]: [...rows, { [field]: null, score: 1 }],
                })
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add threshold
            </button>
            <p className={`${styles.hint} mt-2`}>
              First matching row applies; unmatched values score 1.
            </p>
          </section>
        );
      })}
    </div>
  );
}
