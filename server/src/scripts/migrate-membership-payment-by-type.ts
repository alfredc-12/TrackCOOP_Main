import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, getPool } from "../db/pool";

async function main() {
  const migrationPath = path.resolve(
    process.cwd(),
    "server/database/migrations/20260927_membership_payment_by_type.sql",
  );
  const source = await readFile(migrationPath, "utf8");
  const statements = source
    .split(";")
    .map((statement) => statement
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim())
    .filter(Boolean);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const statement of statements.filter((item) => !/^(START TRANSACTION|COMMIT)$/i.test(item))) {
      await connection.query(statement);
    }
    await connection.commit();
    const [settings] = await connection.query(
      `SELECT setting_key AS settingKey, setting_value AS settingValue
         FROM system_settings
        WHERE setting_key IN (
          'membership.associate_fee',
          'membership.initial_share_capital',
          'membership.true_member_required_capital'
        ) ORDER BY setting_key`,
    );
    console.log("Membership payment settings:", settings);
    const [historicalFees] = await connection.query(
      `SELECT COUNT(DISTINCT a.membership_application_id) AS applicationsWithOldFee
         FROM membership_applications a
         JOIN payment_references p
           ON p.related_entity_type = 'membership_application'
          AND p.related_entity_id = a.membership_application_id
        WHERE a.requested_membership_type = 'True Member'
          AND p.payment_purpose = 'Associate Membership Fee'
          AND p.validation_status = 'Validated'`,
    );
    console.log("True Member applications with an older validated Associate fee:", historicalFees);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Membership payment migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
