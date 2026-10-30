import type { Pool, RowDataPacket } from "mysql2/promise";

type MemberRow = RowDataPacket & { member_id: string };
type ItemRow = RowDataPacket & { amount: string | number; date: Date; ref: string | null; type?: string };

export async function selectMemberStatement(pool: Pick<Pool, "query">, userId: string) {
  const [members] = await pool.query<MemberRow[]>(
    `SELECT m.member_id, m.full_name, m.member_code, m.barangay, m.municipality, m.province,
            m.contact_number, m.membership_type, m.official_member_status, u.email AS user_email
       FROM member_profiles m LEFT JOIN users u ON m.user_id = u.user_id
      WHERE m.user_id = ? LIMIT 1`, [userId],
  );
  const member = members[0];
  if (!member) return null;
  const [accounts] = await pool.query<RowDataPacket[]>(
    `SELECT current_balance AS balance FROM share_capital_accounts WHERE member_id = ? LIMIT 1`, [member.member_id],
  );
  const [ledger] = await pool.query<ItemRow[]>(
    `SELECT CASE WHEN direction = 'Credit' THEN amount ELSE -amount END AS amount,
            transaction_date AS date, reference_number AS ref,
            CASE WHEN source_type = 'patronage_capital_transfer' THEN 'Patronage refund added to capital'
                 WHEN transaction_type = 'Dividend Added to Share Capital' THEN 'Interest added to capital'
                 ELSE transaction_type END AS type
       FROM share_capital_transactions WHERE member_id = ? AND transaction_status = 'Posted'
      ORDER BY transaction_date, share_capital_transaction_id`, [member.member_id],
  );
  let deposits = ledger;
  if (!accounts[0] && !ledger.length) {
    // Preserve statements for legacy members whose ledger has not yet been backfilled.
    [deposits] = await pool.query<ItemRow[]>(
      `SELECT amount, payment_date AS date, CAST(payment_reference_id AS CHAR) AS ref, 'Capital payment' AS type
         FROM share_capital_payments WHERE member_id = ? AND payment_status = 'Validated'
        ORDER BY payment_date, share_payment_id`, [member.member_id],
    );
  }
  const ledgerBalance = deposits.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0) / 100;
  const capitalBalance = accounts[0] ? Number(accounts[0].balance) : ledgerBalance;
  const [purchases] = await pool.query<ItemRow[]>(
    `SELECT sale_number AS ref, sale_date AS date, total_amount AS amount FROM pos_sales
      WHERE member_id = ? AND sale_status IN ('Paid', 'Completed') AND payment_status = 'Paid'
      ORDER BY sale_date, pos_sale_id`, [member.member_id],
  );
  return { member, deposits, purchases, capitalBalance, ledgerBalance,
    reconciled: Math.round(capitalBalance * 100) === Math.round(ledgerBalance * 100) };
}
