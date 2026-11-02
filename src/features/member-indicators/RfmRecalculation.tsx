"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  date,
  errorMessage,
  previewCalculation,
  commitCalculation,
  todayInManila,
  type RfmMemberRow,
  type RfmPreview,
  type RfmRecalculationResult,
} from "./rfm-client";
import { ScoringRules } from "./RfmDetails";
import styles from "./RfmWorkspace.module.css";

export function RfmRecalculation({
  member,
  onComplete,
}: {
  member: RfmMemberRow | null;
  onComplete: () => void;
}) {
  const [basisEnd, setBasisEnd] = useState(todayInManila);
  const [preview, setPreview] = useState<RfmPreview | null>(null);
  const [result, setResult] = useState<RfmRecalculationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  async function execute(commit: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const input = { memberId: member?.memberId, basisPeriodEnd: basisEnd };
      if (commit && preview && confirmed) {
        const saved = await commitCalculation(
          input,
          preview.previewFingerprint,
        );
        setResult(saved);
        onComplete();
      } else {
        setPreview(await previewCalculation(input));
        setConfirmed(false);
      }
    } catch (caught) {
      setError(errorMessage(caught));
      if (commit) {
        setPreview(null);
        setConfirmed(false);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function exportResult() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "rfm-calculation-summary.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="grid gap-5" aria-busy={busy}>
      <p className={styles.notice}>
        {member
          ? `Recalculate ${member.fullName} (${member.memberCode}).`
          : "Recalculate the entire eligible population, independently of table filters."}{" "}
        Only approved members with official status Active or Inactive are
        included. Saved RFM indicators are advisory.
      </p>
      {!result && (
        <>
          <Input
            name="calculation-end"
            label="Calculation end date"
            type="date"
            required
            max={todayInManila()}
            value={basisEnd}
            disabled={busy}
            onChange={(event) => {
              setBasisEnd(event.target.value);
              setPreview(null);
              setConfirmed(false);
            }}
          />
          <p className={styles.muted}>
            The server derives the inclusive rolling 12-month start. An older
            end date creates an explicitly historical calculation.
          </p>
          <Button
            type="button"
            variant="secondary"
            loading={busy && !preview}
            disabled={!basisEnd || busy}
            onClick={() => void execute(false)}
          >
            Preview calculation
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error} Previous saved results remain available. Retry the preview to
          continue.
        </p>
      )}
      {preview && !result && (
        <>
          <h3>Server calculation preview</h3>
          <dl className={styles.definition}>
            <dt>Basis period</dt>
            <dd>
              {date(preview.basis.start)} – {date(preview.basis.end)}
            </dd>
            <dt>Eligible members affected</dt>
            <dd>{preview.affected}</dd>
            <dt>New scores for this basis</dt>
            <dd>{preview.newlyScored}</dd>
            <dt>Classification changes</dt>
            <dd>
              {preview.changed} changed · {preview.unchanged} unchanged,
              compared with the saved observation for this exact basis.
            </dd>
            <dt>No qualifying participation</dt>
            <dd>{preview.missingParticipation} members</dd>
            <dt>No validated contributions</dt>
            <dd>{preview.zeroContributions} members</dd>
            <dt>Version</dt>
            <dd>{preview.settings.formulaVersion}</dd>
          </dl>
          <ScoringRules settings={preview.settings} />
          <p className={styles.muted}>
            Source tables were read successfully. Zero recorded evidence does
            not prove that operational data is complete. The server checks this
            preview again before saving.
          </p>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm saving RFM results for {preview.affected} eligible
            member(s) for this basis. Official membership statuses will remain
            unchanged.
          </label>
          <Button
            type="button"
            disabled={!confirmed || !preview.affected}
            loading={busy}
            onClick={() => void execute(true)}
          >
            Confirm and save indicators
          </Button>
        </>
      )}
      {result && (
        <div role="status" className="grid gap-4">
          <h3>Calculation completed</h3>
          <dl className={styles.definition}>
            <dt>Calculated members</dt>
            <dd>{result.affected}</dd>
            <dt>New observations saved</dt>
            <dd>{result.saved}</dd>
            <dt>Identical results skipped</dt>
            <dd>{result.skippedIdentical}</dd>
            <dt>New for this basis</dt>
            <dd>{result.newlyScored}</dd>
            <dt>Classifications</dt>
            <dd>
              {result.changed} changed · {result.unchanged} unchanged
            </dd>
            <dt>Basis</dt>
            <dd>
              {date(result.basis.start)} – {date(result.basis.end)}
            </dd>
            <dt>Completed</dt>
            <dd>
              {new Date(result.computedAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}{" "}
              (Manila)
            </dd>
            <dt>Version</dt>
            <dd>{result.settings.formulaVersion}</dd>
            <dt>Run reference</dt>
            <dd>{result.runId}</dd>
          </dl>
          <Button variant="secondary" type="button" onClick={exportResult}>
            Export recalculation summary
          </Button>
        </div>
      )}
    </div>
  );
}
