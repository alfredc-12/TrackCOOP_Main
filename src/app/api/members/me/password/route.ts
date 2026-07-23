import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/next-api-auth";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const connection = await db.getConnection();
    try {
      const [users] = await connection.query<RowDataPacket[]>(
        `SELECT password_hash FROM users WHERE user_id = ?`,
        [auth.user.id]
      );
      
      const user = users[0];
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await connection.query(
        `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?`,
        [hashedPassword, auth.user.id]
      );

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Failed to update password:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
