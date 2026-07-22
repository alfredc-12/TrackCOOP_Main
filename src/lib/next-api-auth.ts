import { NextResponse } from "next/server";
import type { Role } from "@/config/roles";
import type { AuthUser } from "@/features/auth/types";
import { getServerAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

type MemberProfileRow = RowDataPacket & {
  memberId: string;
};

export type AuthorizedUser = AuthUser & {
  numericId: number;
};

type ApiAuthResult =
  | {
      user: null;
      response: NextResponse;
    }
  | {
      user: AuthorizedUser;
      response: null;
    };

export async function requireApiUser(
  allowedRoles?: Role[],
): Promise<ApiAuthResult> {
  const user = await getServerAuthUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 },
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 },
      ),
    };
  }

  const numericId = Number(user.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authenticated user is not linked to a valid account." },
        { status: 403 },
      ),
    };
  }

  return {
    user: { ...user, numericId } satisfies AuthorizedUser,
    response: null,
  };
}

export async function getMemberProfileIdForUser(userId: number) {
  const [rows] = await db.query<MemberProfileRow[]>(
    `SELECT CAST(member_id AS CHAR) AS memberId
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );

  const memberId = Number(rows[0]?.memberId);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
}
