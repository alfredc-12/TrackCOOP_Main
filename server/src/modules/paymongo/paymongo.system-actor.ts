import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { PaymentValidationSource } from "./paymongo.settlement.types";

export const PAYMONGO_SYSTEM_ACTOR_USERNAME = "paymongo-system";
export const PAYMONGO_SYSTEM_ACTOR_DISPLAY_NAME = "PayMongo System Service";

export type PaymongoSettlementActor = {
  id: string;
  actorType: "Authenticated Bookkeeper" | "PayMongo System Service";
};

type ActorRow = RowDataPacket & {
  id: string;
  displayName: string;
  username: string | null;
  accountStatus: string;
  role: string;
  roleIsActive: number;
};

export function assertPaymongoPortalLoginAllowed(
  accountId: string,
  configuredSystemActorUserId: string | undefined,
) {
  if (configuredSystemActorUserId && accountId === configuredSystemActorUserId) {
    throw new AppError(
      "This account is reserved for automated PayMongo processing and cannot sign in",
      403,
      "PAYMONGO_SYSTEM_ACCOUNT_LOGIN_DISABLED",
    );
  }
}

async function findActor(connection: PoolConnection, userId: string) {
  const [rows] = await connection.execute<ActorRow[]>(
    `SELECT CAST(u.user_id AS CHAR) AS id,
            u.display_name AS displayName,
            u.username,
            u.account_status AS accountStatus,
            r.role_slug AS role,
            r.is_active AS roleIsActive
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE u.user_id = ?
      LIMIT 1 FOR UPDATE`,
    [userId],
  );
  return rows[0] ?? null;
}

function activeBookkeeper(row: ActorRow | null) {
  return Boolean(
    row
    && row.accountStatus === "Active"
    && row.role === "bookkeeper"
    && row.roleIsActive === 1,
  );
}

export async function resolvePaymongoSettlementActor(
  connection: PoolConnection,
  input: {
    validationSource: PaymentValidationSource;
    actorUserId: string | null;
    configuredSystemActorUserId?: string;
  },
): Promise<PaymongoSettlementActor> {
  if (input.validationSource === "Manual Bookkeeper") {
    if (!input.actorUserId) {
      throw new AppError(
        "Authenticated Bookkeeper attribution is required for manual settlement",
        401,
        "PAYMENT_MANUAL_ACTOR_REQUIRED",
      );
    }
    if (
      input.configuredSystemActorUserId
      && input.actorUserId === input.configuredSystemActorUserId
    ) {
      throw new AppError(
        "The PayMongo service account cannot perform manual Bookkeeper actions",
        403,
        "PAYMENT_MANUAL_ACTOR_INVALID",
      );
    }
    const actor = await findActor(connection, input.actorUserId);
    if (!activeBookkeeper(actor)) {
      throw new AppError(
        "The authenticated Bookkeeper is not eligible to validate payments",
        403,
        "PAYMENT_MANUAL_ACTOR_INVALID",
      );
    }
    return { id: actor!.id, actorType: "Authenticated Bookkeeper" };
  }

  if (input.actorUserId) {
    throw new AppError(
      "PayMongo webhook settlement cannot be attributed to a human user",
      400,
      "PAYMONGO_WEBHOOK_HUMAN_ACTOR_NOT_ALLOWED",
    );
  }
  if (!input.configuredSystemActorUserId) {
    throw new AppError(
      "PAYMONGO_SYSTEM_ACTOR_USER_ID is required for automated settlement",
      503,
      "PAYMONGO_SYSTEM_ACTOR_REQUIRED",
    );
  }

  const actor = await findActor(connection, input.configuredSystemActorUserId);
  if (!actor) {
    throw new AppError(
      "The configured PayMongo system actor does not exist",
      503,
      "PAYMONGO_SYSTEM_ACTOR_NOT_FOUND",
    );
  }
  if (
    !activeBookkeeper(actor)
    || actor.username !== PAYMONGO_SYSTEM_ACTOR_USERNAME
    || actor.displayName !== PAYMONGO_SYSTEM_ACTOR_DISPLAY_NAME
  ) {
    throw new AppError(
      "The configured PayMongo system actor is not a valid active service account",
      503,
      "PAYMONGO_SYSTEM_ACTOR_INVALID",
    );
  }

  return { id: actor.id, actorType: "PayMongo System Service" };
}
