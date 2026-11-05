import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  capitalCompletion,
  calendarMonths,
  manilaDate,
  MEMBERSHIP_POLICY_VERSION,
} from "./membership-policy";

type Executor = Pool | PoolConnection;
export type CapitalCase = RowDataPacket & {
  id: string;
  applicationId: string | null;
  upgradeId: string | null;
  memberId: string | null;
  startedOn: string;
  deadline: string;
  opening: number | string;
  target: number | string;
  createdAt: Date;
  name: string;
  email: string | null;
  closedAt: Date | null;
};
export async function createApplicationCapitalCase(
  db: Executor,
  applicationId: string,
) {
  await db.execute(
    `INSERT IGNORE INTO membership_capital_cases
  (membership_application_id,policy_version,started_on,reminder_on,deadline,created_at)
  SELECT membership_application_id,?,DATE(CONVERT_TZ(submitted_at,'+00:00','+08:00')),
   DATE_ADD(DATE(CONVERT_TZ(submitted_at,'+00:00','+08:00')),INTERVAL 3 MONTH),
   DATE_ADD(DATE(CONVERT_TZ(submitted_at,'+00:00','+08:00')),INTERVAL 6 MONTH),UTC_TIMESTAMP()
  FROM membership_applications WHERE membership_application_id=? AND requested_membership_type='True Member'`,
    [MEMBERSHIP_POLICY_VERSION, applicationId],
  );
}
export async function createUpgradeCapitalCase(
  db: Executor,
  upgradeId: string,
  memberId: string,
) {
  // An original True application already owns its completion obligation; a duplicate upgrade must not restart it.
  await db.execute(
    `INSERT INTO membership_capital_cases(upgrade_request_id,member_id,policy_version,started_on,reminder_on,deadline,opening_validated_capital,created_at)
 SELECT ?,m.member_id,?,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')),
 DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')),INTERVAL 3 MONTH),
 LEAST(COALESCE(m.share_capital_deadline,'9999-12-31'),DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')),INTERVAL 6 MONTH)),
 COALESCE((SELECT current_balance FROM share_capital_accounts WHERE member_id=m.member_id),
 (SELECT COALESCE(SUM(amount),0) FROM share_capital_payments WHERE member_id=m.member_id AND payment_status='Validated')),UTC_TIMESTAMP()
 FROM member_profiles m WHERE m.member_id=? AND NOT EXISTS
 (SELECT 1 FROM membership_capital_cases c WHERE c.member_id=m.member_id AND c.closed_at IS NULL)`,
    [upgradeId, MEMBERSHIP_POLICY_VERSION, memberId],
  );
}
export async function capitalCases(
  db: Executor,
  where = "1=1",
  params: (string | number)[] = [],
) {
  const [rows] = await db.execute<CapitalCase[]>(
    `SELECT CAST(c.capital_case_id AS CHAR) AS id,
 CAST(c.membership_application_id AS CHAR) AS applicationId,CAST(c.upgrade_request_id AS CHAR) AS upgradeId,
 CAST(c.member_id AS CHAR) AS memberId,DATE_FORMAT(c.started_on,'%Y-%m-%d') AS startedOn,
 DATE_FORMAT(c.deadline,'%Y-%m-%d') AS deadline,c.opening_validated_capital AS opening,c.required_capital AS target,
 c.created_at AS createdAt,c.closed_at AS closedAt,COALESCE(m.full_name,CONCAT_WS(' ',a.first_name,a.middle_name,a.last_name)) AS name,
 COALESCE(m.email,a.email) AS email FROM membership_capital_cases c
 LEFT JOIN membership_applications a ON a.membership_application_id=c.membership_application_id
 LEFT JOIN member_profiles m ON m.member_id=c.member_id WHERE ${where} ORDER BY c.capital_case_id DESC`,
    params,
  );
  return rows;
}
export async function recordApplicationCapitalEvent(
  db: Executor,
  paymentId: string,
  reversed = false,
) {
  // Only new-policy application capital is tracked; other modules/legacy obligations are unaffected.
  await db.execute(
    `INSERT IGNORE INTO membership_capital_events(capital_case_id,event_key,amount,description,occurred_at)
 SELECT c.capital_case_id,CONCAT('application-capital:',p.payment_reference_id,?),IF(?, -p.amount,p.amount),?,UTC_TIMESTAMP()
 FROM payment_references p JOIN membership_capital_cases c ON c.membership_application_id=p.related_entity_id
 WHERE p.payment_reference_id=? AND p.related_entity_type='membership_application' AND p.payment_purpose='Share Capital'`,
    [
      reversed ? ":reversed" : ":validated",
      reversed,
      reversed ? "Validated capital reversed" : "Capital validated",
      paymentId,
    ],
  );
}
export async function caseProgress(
  db: Executor,
  c: CapitalCase,
  asOf = manilaDate(),
) {
  // Treat UTC record/validation time as the knowledge boundary, not a backdated payment date.
  const cutoff = `${asOf} 23:59:59`;
  const [events] = await db.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount),0) AS total FROM membership_capital_events
 WHERE capital_case_id=? AND CONVERT_TZ(occurred_at,'+00:00','+08:00')<=?`,
    [c.id, cutoff],
  );
  let ledger = 0;
  if (c.memberId) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(IF(t.direction='Credit',t.amount,-t.amount)),0) AS total
   FROM share_capital_transactions t LEFT JOIN share_capital_payments p
    ON t.source_type IN ('share_capital_payment','share_capital_payment_reversal') AND p.share_payment_id=t.source_id
   LEFT JOIN payment_references r ON r.payment_reference_id=p.payment_reference_id
   WHERE t.member_id=? AND t.transaction_status='Posted' AND t.created_at>=?
    AND CONVERT_TZ(t.created_at,'+00:00','+08:00')<=?
    AND (? IS NULL OR NOT (r.related_entity_type <=> 'membership_application' AND r.related_entity_id <=> ?))`,
      [c.memberId, c.createdAt, cutoff, c.applicationId, c.applicationId],
    );
    ledger = Number(rows[0]?.total ?? 0);
  }
  const [pending] = await db.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payment_references
  WHERE payment_purpose='Share Capital' AND validation_status IN ('Pending','Needs Clarification')
  AND ((related_entity_type='membership_application' AND related_entity_id=?) OR (member_id=? AND NOT(related_entity_type <=> 'membership_application')))`,
    [c.applicationId, c.memberId],
  );
  return {
    caseId: c.id,
    policyVersion: MEMBERSHIP_POLICY_VERSION,
    ...capitalCompletion({
      startedOn: c.startedOn,
      deadline: c.deadline,
      target: Number(c.target),
      validated: Number(c.opening) + Number(events[0]?.total ?? 0) + ledger,
      pending: Number(pending[0]?.total ?? 0),
      asOf,
    }),
  };
}
export type CapitalReportingFilters = {
  barangays?: string[];
  sectors?: string[];
  membershipType?: string;
};
export async function monthlyCapitalProgress(
  db: Executor,
  start: string,
  end: string,
  filters: CapitalReportingFilters = {},
) {
  const where = ["1=1"];
  const params: string[] = [];
  if (filters.membershipType) {
    where.push("COALESCE(a.requested_membership_type,'True Member')=?");
    params.push(filters.membershipType);
  }
  if (filters.barangays?.length) {
    where.push(
      `COALESCE(m.barangay,a.barangay) IN (${filters.barangays.map(() => "?").join(",")})`,
    );
    params.push(...filters.barangays);
  }
  if (filters.sectors?.length) {
    const placeholders = filters.sectors.map(() => "?").join(",");
    where.push(
      `(EXISTS(SELECT 1 FROM member_sectors ms JOIN cooperative_sectors cs ON cs.sector_id=ms.sector_id WHERE ms.member_id=c.member_id AND cs.sector_name IN (${placeholders})) OR EXISTS(SELECT 1 FROM membership_application_sectors aps JOIN cooperative_sectors cs ON cs.sector_id=aps.sector_id WHERE aps.membership_application_id=c.membership_application_id AND cs.sector_name IN (${placeholders})))`,
    );
    params.push(...filters.sectors, ...filters.sectors);
  }
  const cases = await capitalCases(db, where.join(" AND "), params);
  // Read evidence in batches once. Do not issue one SQL query per case per reporting month.
  const caseIds = cases.map((c) => c.id);
  const memberIds = [
    ...new Set(cases.flatMap((c) => (c.memberId ? [c.memberId] : []))),
  ];
  type Event = RowDataPacket & {
    caseId: string;
    amount: number | string;
    at: Date | string;
  };
  type Ledger = RowDataPacket & {
    memberId: string;
    amount: number | string;
    direction: string;
    at: Date | string;
    applicationId: string | null;
  };
  const [events] = caseIds.length
    ? await db.execute<Event[]>(
        `SELECT CAST(capital_case_id AS CHAR) AS caseId,amount,occurred_at AS at FROM membership_capital_events WHERE capital_case_id IN (${caseIds.map(() => "?").join(",")})`,
        caseIds,
      )
    : [[]];
  const [ledger] = memberIds.length
    ? await db.execute<Ledger[]>(
        `SELECT CAST(t.member_id AS CHAR) AS memberId,t.amount,t.direction,t.created_at AS at,
 IF(r.related_entity_type='membership_application',CAST(r.related_entity_id AS CHAR),NULL) AS applicationId
 FROM share_capital_transactions t LEFT JOIN share_capital_payments p ON t.source_type IN ('share_capital_payment','share_capital_payment_reversal') AND p.share_payment_id=t.source_id
 LEFT JOIN payment_references r ON r.payment_reference_id=p.payment_reference_id
 WHERE t.member_id IN (${memberIds.map(() => "?").join(",")}) AND t.transaction_status='Posted'`,
        memberIds,
      )
    : [[]];
  const result = [];
  for (
    let month = start.slice(0, 7) + "-01";
    month <= end;
    month = calendarMonths(month, 1)
  ) {
    const next = calendarMonths(month, 1);
    const monthEnd = new Date(Date.parse(next + "T00:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10);
    const asOf = monthEnd < end ? monthEnd : end;
    const eligible = cases.filter(
      (c) =>
        c.startedOn <= asOf && (!c.closedAt || manilaDate(c.closedAt) > asOf),
    );
    const progress = eligible.map((c) => {
      const applicationCapital = events
        .filter((e) => String(e.caseId) === c.id && manilaDate(e.at) <= asOf)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const ownCapital = ledger
        .filter(
          (e) =>
            e.memberId === c.memberId &&
            new Date(e.at) >= new Date(c.createdAt) &&
            manilaDate(e.at) <= asOf &&
            (!c.applicationId || e.applicationId !== c.applicationId),
        )
        .reduce(
          (sum, e) =>
            sum + (e.direction === "Credit" ? 1 : -1) * Number(e.amount),
          0,
        );
      return capitalCompletion({
        startedOn: c.startedOn,
        deadline: c.deadline,
        target: Number(c.target),
        validated: Number(c.opening) + applicationCapital + ownCapital,
        asOf,
      });
    });
    result.push({
      month: month.slice(0, 7),
      applications: eligible.length,
      incomplete: progress.filter((p) => p.status !== "Completed").length,
      reminder: progress.filter((p) => p.status === "Reminder").length,
      overdue: progress.filter((p) => p.status === "Overdue").length,
      completed: progress.filter((p) => p.status === "Completed").length,
      outstanding:
        Math.round(progress.reduce((sum, p) => sum + p.remaining, 0) * 100) /
        100,
    });
  }
  return result;
}
