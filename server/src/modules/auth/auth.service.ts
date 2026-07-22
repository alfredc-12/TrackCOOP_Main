import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import {
  createAuthRepository,
  type AuthRepository,
} from "./auth.repository";
import {
  isRoleSlug,
  type AuthContext,
  type LoginRequest,
  type LoginResult,
  type RequestContext,
} from "./auth.types";

const DUMMY_PASSWORD_HASH =
  "$2b$12$MafgiF5l0M225nSQDpQCqetAsB1CW59KjFCwbfBxUilxqd8W/UWt.";

type AuthServiceOptions = {
  maxFailedAttempts: number;
  lockoutMinutes: number;
  sessionTtlHours: number;
  now: () => Date;
  generateToken: () => string;
  hashToken: (token: string) => string;
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>;
};

export interface AuthService {
  login(input: LoginRequest, context: RequestContext): Promise<LoginResult>;
  authenticate(rawToken: string | undefined): Promise<AuthContext>;
  logout(auth: AuthContext): Promise<void>;
  listSessions(auth: AuthContext): ReturnType<AuthRepository["listSessions"]>;
  revokeSession(auth: AuthContext, sessionId: string): Promise<void>;
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const defaultOptions: AuthServiceOptions = {
  maxFailedAttempts: env.AUTH_MAX_FAILED_ATTEMPTS,
  lockoutMinutes: env.AUTH_LOCKOUT_MINUTES,
  sessionTtlHours: env.SESSION_TTL_HOURS,
  now: () => new Date(),
  generateToken: () => randomBytes(32).toString("base64url"),
  hashToken: hashSessionToken,
  verifyPassword: compare,
};

export function createAuthService(
  repository: AuthRepository = createAuthRepository(),
  options: Partial<AuthServiceOptions> = {},
): AuthService {
  const settings = { ...defaultOptions, ...options };

  return {
    async login(input, context) {
      const account = await repository.findLoginAccount(input.identifier);
      const passwordMatches = await settings.verifyPassword(
        input.password,
        account?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );

      if (!account || !passwordMatches) {
        if (account) {
          const failedLoginCount = Math.min(
            account.failedLoginCount + 1,
            settings.maxFailedAttempts,
          );
          const lockedUntil =
            failedLoginCount >= settings.maxFailedAttempts
              ? new Date(
                  settings.now().getTime() + settings.lockoutMinutes * 60_000,
                )
              : account.lockedUntil;

          await repository.recordFailedLogin({
            ...context,
            userId: account.id,
            failedLoginCount,
            lockedUntil,
          });
        }

        throw new AppError(
          "The email, username, or password is incorrect",
          401,
          "INVALID_CREDENTIALS",
        );
      }

      const now = settings.now();

      if (account.lockedUntil && account.lockedUntil.getTime() > now.getTime()) {
        throw new AppError(
          "This account is temporarily locked. Try again later.",
          423,
          "ACCOUNT_LOCKED",
        );
      }

      if (
        account.accountStatus !== "Active" ||
        !account.roleIsActive ||
        !isRoleSlug(account.role)
      ) {
        throw new AppError(
          "This account is not available for sign in",
          403,
          "ACCOUNT_INACTIVE",
        );
      }

      const rawToken = settings.generateToken();
      const expiresAt = new Date(
        now.getTime() + settings.sessionTtlHours * 60 * 60_000,
      );

      await repository.createSession({
        ...context,
        userId: account.id,
        tokenHash: settings.hashToken(rawToken),
        expiresAt,
      });

      return {
        rawToken,
        expiresAt,
        user: {
          id: account.id,
          displayName: account.displayName,
          email: account.email,
          username: account.username,
          role: account.role,
        },
      };
    },

    async authenticate(rawToken) {
      if (!rawToken || rawToken.length < 32) {
        throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      }

      const auth = await repository.findSession(settings.hashToken(rawToken));

      if (!auth || !isRoleSlug(auth.user.role)) {
        throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      }

      return auth;
    },

    logout(auth) {
      return repository.revokeCurrentSession(auth);
    },

    listSessions(auth) {
      return repository.listSessions(auth.user.id, auth.tokenHash);
    },

    async revokeSession(auth, sessionId) {
      const revoked = await repository.revokeSessionById(auth.user.id, sessionId);

      if (!revoked) {
        throw new AppError("Session was not found", 404, "SESSION_NOT_FOUND");
      }
    },
  };
}
