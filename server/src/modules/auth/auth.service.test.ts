import assert from "node:assert/strict";
import test from "node:test";
import type { AuthRepository } from "./auth.repository";
import { createAuthService } from "./auth.service";
import type { LoginAccount } from "./auth.types";

const activeAccount: LoginAccount = {
  id: "42",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chairperson",
  passwordHash: "stored-hash",
  role: "chairman",
  accountStatus: "Active",
  failedLoginCount: 0,
  lockedUntil: null,
  roleIsActive: true,
};

function createRepository(overrides: Partial<AuthRepository> = {}) {
  const repository: AuthRepository = {
    async findLoginAccount() {
      return activeAccount;
    },
    async recordFailedLogin() {},
    async createSession() {},
    async findSession() {
      return null;
    },
    async revokeCurrentSession() {},
    async listSessions() {
      return [];
    },
    async revokeSessionById() {
      return true;
    },
    ...overrides,
  };

  return repository;
}

test("login stores only a hash of the generated opaque session token", async () => {
  let storedTokenHash = "";
  const repository = createRepository({
    async createSession(input) {
      storedTokenHash = input.tokenHash;
    },
  });
  const service = createAuthService(repository, {
    generateToken: () => "raw-session-token-that-never-enters-the-database",
    hashToken: (token) => `hash:${token}`,
    now: () => new Date("2026-07-18T00:00:00.000Z"),
    sessionTtlHours: 12,
    verifyPassword: async () => true,
  });

  const result = await service.login(
    { identifier: activeAccount.email, password: "correct-password" },
    { ipAddress: "127.0.0.1", userAgent: "test" },
  );

  assert.equal(
    result.rawToken,
    "raw-session-token-that-never-enters-the-database",
  );
  assert.equal(
    storedTokenHash,
    "hash:raw-session-token-that-never-enters-the-database",
  );
  assert.equal(result.user.role, "chairman");
  assert.equal(result.expiresAt.toISOString(), "2026-07-18T12:00:00.000Z");
});

test("the fifth failed login records a temporary lockout", async () => {
  let failedLoginCount = 0;
  let lockedUntil: Date | null = null;
  const repository = createRepository({
    async findLoginAccount() {
      return { ...activeAccount, failedLoginCount: 4 };
    },
    async recordFailedLogin(input) {
      failedLoginCount = input.failedLoginCount;
      lockedUntil = input.lockedUntil;
    },
  });
  const service = createAuthService(repository, {
    lockoutMinutes: 15,
    maxFailedAttempts: 5,
    now: () => new Date("2026-07-18T00:00:00.000Z"),
    verifyPassword: async () => false,
  });

  await assert.rejects(
    service.login(
      { identifier: activeAccount.email, password: "wrong-password" },
      { ipAddress: null, userAgent: null },
    ),
    (error: unknown) =>
      error instanceof Error && error.message.includes("incorrect"),
  );

  assert.equal(failedLoginCount, 5);
  assert.equal(
    (lockedUntil as Date | null)?.toISOString(),
    "2026-07-18T00:15:00.000Z",
  );
});

test("authenticate hashes the cookie token before session lookup", async () => {
  let lookedUpHash = "";
  const repository = createRepository({
    async findSession(tokenHash) {
      lookedUpHash = tokenHash;
      return {
        sessionId: "7",
        tokenHash,
        user: activeAccount,
      };
    },
  });
  const service = createAuthService(repository, {
    hashToken: (token) => `sha256:${token}`,
  });

  const auth = await service.authenticate("a".repeat(32));

  assert.equal(lookedUpHash, `sha256:${"a".repeat(32)}`);
  assert.equal(auth.user.id, activeAccount.id);
});
