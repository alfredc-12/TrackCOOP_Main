import type { Pool } from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { enqueueEmail } from "../email/email-outbox.repository";
import { getEmailConfig, type EmailConfig } from "../email/email-config";
import { capitalCases, caseProgress } from "./membership-progress.repository";
import { manilaDate } from "./membership-policy";
export async function enqueueCapitalReminders(
  pool: Pool,
  config: EmailConfig = getEmailConfig(),
  today = manilaDate(),
) {
  const counts = { queued: 0, duplicate: 0, skipped: 0 };
  if (config.mode !== "resend") return { ...counts, disabled: true };
  const cases = await capitalCases(
    pool,
    "c.closed_at IS NULL AND c.reminder_on<=?",
    [today],
  );
  for (const c of cases)
    await withTransaction(async (db) => {
      const progress = await caseProgress(db, c, today);
      if (progress.status !== "Reminder" && progress.status !== "Overdue")
        return;
      const milestone =
        progress.status === "Overdue" ? "six-month" : "three-month";
      const result = await enqueueEmail(
        db,
        {
          eventKey: "membership.capital.reminder",
          dedupeKey: `capital:${c.id}:${milestone}`,
          to: { email: c.email, name: c.name },
          payload: { caseId: c.id, milestone },
          related: { type: "membership_capital_case", id: c.id },
        },
        config,
      );
      if (result.outcome === "queued") counts.queued++;
      else if (result.outcome === "duplicate") counts.duplicate++;
      else counts.skipped++;
    }, pool);
  return counts;
}
