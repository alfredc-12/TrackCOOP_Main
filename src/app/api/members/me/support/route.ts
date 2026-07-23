import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const connection = await db.getConnection();
    try {
      const [members] = await connection.query<RowDataPacket[]>(
        `SELECT member_id FROM member_profiles WHERE user_id = ?`,
        [auth.user.id]
      );

      const member = members[0];
      if (!member) {
        return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
      }

      const [tickets] = await connection.query<RowDataPacket[]>(
        `SELECT ticket_id, subject, message, status, created_at 
         FROM support_tickets 
         WHERE member_id = ? 
         ORDER BY created_at DESC`,
        [member.member_id]
      );

      return NextResponse.json(tickets);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Failed to fetch support tickets:", error);
    // Return empty array on error (table might not exist yet)
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const body = await req.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const connection = await db.getConnection();
    try {
      const [members] = await connection.query<RowDataPacket[]>(
        `SELECT member_id FROM member_profiles WHERE user_id = ?`,
        [auth.user.id]
      );

      const member = members[0];
      if (!member) {
        return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
      }

      await connection.query(
        `INSERT INTO support_tickets (member_id, subject, message, status, created_at)
         VALUES (?, ?, ?, 'Pending', NOW())`,
        [member.member_id, subject, message]
      );

      return NextResponse.json({ success: true, message: "Support ticket submitted successfully" });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Failed to submit support ticket:", error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: "Support module is not fully setup yet. Please contact admin directly." }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 });
  }
}
