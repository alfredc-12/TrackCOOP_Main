import type { RequestHandler } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../db/pool";
import { AppError } from "../utils/app-error";

export function canAccessMemberFinancials(member: { membership_type?: string }): boolean {
  return member.membership_type === "True Member";
}

export function requireTrueMember(pool?: Pool): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const [rows] = await (pool ?? getPool()).execute<(RowDataPacket & { membership_type: string })[]>(
        "SELECT membership_type FROM member_profiles WHERE user_id = ? LIMIT 1",
        [request.auth.user.id],
      );
      if (!rows[0] || !canAccessMemberFinancials(rows[0])) {
        throw new AppError("Exclusive to True Members", 403, "TRUE_MEMBER_REQUIRED");
      }
      next();
    } catch (error) { next(error); }
  };
}
