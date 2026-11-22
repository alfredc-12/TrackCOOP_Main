import assert from "node:assert/strict";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

/**
 * Development-only fixture for making the chairman demographic profile and
 * barangay map easy to demonstrate. It only fills blank occupations on
 * already-approved members; existing member-entered occupations are preserved.
 *
 * Default mode is read-only. Use `--apply` explicitly to write the fixture.
 */
const mode = process.argv[2] ?? "--dry-run";
assert.ok(["--dry-run", "--apply", "--verify"].includes(mode), "Use --dry-run, --apply or --verify");

const SAMPLE_MARKER = "Occupation demographic visualization sample";
const occupations = [
  "Farmer",
  "Fisherfolk",
  "Livestock raiser",
  "Poultry raiser",
  "Aquaculture worker",
  "Agricultural worker",
  "Fish vendor",
  "Entrepreneur",
  "Government employee",
  "Private employee",
  "Self-employed",
  "Student",
  "Retired",
  "Unemployed",
] as const;

type MemberRow = RowDataPacket & {
  member_id: string | number;
  member_code: string;
  full_name: string;
  barangay: string | null;
};

type OccupationCountRow = RowDataPacket & {
  occupation: string;
  count: number | string;
};

async function readAvailableMembers(connection: PoolConnection) {
  const [rows] = await connection.query<MemberRow[]>(
    `SELECT member_id, member_code, full_name, barangay
       FROM member_profiles
      WHERE approval_status = 'Approved'
        AND (occupation IS NULL OR TRIM(occupation) = '')
      ORDER BY member_id
      LIMIT ?`,
    [occupations.length],
  );
  return rows;
}

async function main() {
  const connection = await getPool().getConnection();

  try {
    if (mode === "--verify") {
      const [rows] = await connection.query<OccupationCountRow[]>(
        `SELECT occupation, COUNT(*) AS count
           FROM member_profiles
          WHERE approval_status = 'Approved'
            AND occupation IS NOT NULL
            AND CHAR_LENGTH(TRIM(occupation)) > 0
          GROUP BY occupation
          ORDER BY occupation`,
      );
      console.table(rows.map((row) => ({ occupation: row.occupation, count: Number(row.count) })));
      return;
    }

    const members = await readAvailableMembers(connection);
    const preview = occupations.map((occupation, index) => ({ occupation, member: members[index] ?? null }));
    const missing = preview.filter((row) => !row.member);

    console.info(`Approved members with a blank occupation: ${members.length}.`);
    console.table(preview.map(({ occupation, member }) => ({
      occupation,
      memberCode: member?.member_code ?? "Not available",
      memberName: member?.full_name ?? "Not available",
      barangay: member?.barangay ?? "Not recorded",
    })));

    if (missing.length) {
      console.warn(`Cannot demonstrate ${missing.length} occupation categories because there are not enough approved members with blank occupations.`);
      console.warn("No records were changed. Approve more members or clear only intentional demo records, then run again.");
      return;
    }

    if (mode === "--dry-run") {
      console.info("Dry run only. No database records were changed. Use --apply to write the sample occupations.");
      return;
    }

    await connection.beginTransaction();
    try {
      for (const [index, occupation] of occupations.entries()) {
        const member = members[index];
        await connection.execute(
          `UPDATE member_profiles
              SET occupation = ?, updated_at = CURRENT_TIMESTAMP
            WHERE member_id = ?
              AND approval_status = 'Approved'
              AND (occupation IS NULL OR TRIM(occupation) = '')`,
          [occupation, member.member_id],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.info(`${SAMPLE_MARKER} applied to ${occupations.length} approved members.`);
    console.info("Refresh the Chairman dashboard and select a barangay to see the occupation counts on the map.");
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Demographic occupation sample seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
