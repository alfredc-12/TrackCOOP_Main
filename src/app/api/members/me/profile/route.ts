import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import { RowDataPacket } from "mysql2";

export async function PUT(req: Request) {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const body = await req.json();
    const { contact_number, email, barangay, municipality, province } = body;

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
        `UPDATE member_profiles 
         SET contact_number = ?, email = ?, barangay = ?, municipality = ?, province = ?, updated_at = NOW() 
         WHERE member_id = ?`,
        [contact_number, email, barangay, municipality, province, member.member_id]
      );

      // If email changed, also update the users table to keep it in sync (optional but good practice)
      if (email) {
        await connection.query(
          `UPDATE users SET email = ?, updated_at = NOW() WHERE user_id = ?`,
          [email, auth.user.id]
        );
      }

      return NextResponse.json({ success: true, message: "Profile updated successfully" });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
