import { requireApiUser } from "@/lib/next-api-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import StatementPrintView from "./statement-print-view";

export default async function StatementPage() {
  const auth = await requireApiUser(["member"]);
  if (auth.response) {
    redirect("/login");
  }

  const connection = await db.getConnection();
  try {
    const [members] = await connection.query<RowDataPacket[]>(
      `SELECT m.*, u.email as user_email 
       FROM member_profiles m
       LEFT JOIN users u ON m.user_id = u.user_id
       WHERE m.user_id = ?`,
      [auth.user.id]
    );
    
    const member = members[0];
    if (!member) {
      return <div className="p-10 text-center">Member profile not found.</div>;
    }

    // Get Share Capital
    const [deposits] = await connection.query<RowDataPacket[]>(
      `SELECT amount, payment_date as date, payment_reference_id as ref
       FROM share_capital_payments 
       WHERE member_id = ? AND payment_status = 'Validated'
       ORDER BY payment_date ASC`,
      [member.member_id]
    );

    // Get Purchases
    const [purchases] = await connection.query<RowDataPacket[]>(
      `SELECT sale_number as ref, sale_date as date, total_amount as amount
       FROM pos_sales 
       WHERE member_id = ? AND sale_status = 'Completed'
       ORDER BY sale_date ASC`,
      [member.member_id]
    );

    return (
      <StatementPrintView 
        member={member} 
        deposits={deposits} 
        purchases={purchases} 
      />
    );
  } finally {
    connection.release();
  }
}
