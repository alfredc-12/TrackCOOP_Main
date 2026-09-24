import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app";
import type { AuthService } from "./auth.service";
import type { AuthContext, AuthUser } from "./auth.types";

const frontendUrl = "http://localhost:3000";
const user: AuthUser = {
  id: "42",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chairperson",
  role: "chairman",
};
const auth: AuthContext = {
  user,
  sessionId: "9",
  tokenHash: "hashed-cookie",
};

function createService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    async login() {
      return {
        user,
        rawToken: "raw-session-token-that-is-long-enough",
        expiresAt: new Date("2026-07-18T12:00:00.000Z"),
      };
    },
    async authenticate(rawToken) {
      if (!rawToken) {
        const error = new Error("Authentication is required") as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 401;
        error.code = "UNAUTHENTICATED";
        throw error;
      }
      return auth;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
    ...overrides,
  };
}

test("POST /api/auth/login sets an opaque HttpOnly SameSite cookie", async () => {
  const response = await request(
    createApp({
      authService: createService(),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .post("/api/auth/login")
    .set("Origin", frontendUrl)
    .send({ identifier: user.email, password: "valid-password" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.role, "chairman");
  const cookie = response.headers["set-cookie"]?.[0] ?? "";
  assert.match(cookie, /^trackcoop_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Domain=/);
  assert.doesNotMatch(cookie, /Secure/);
  assert.doesNotMatch(cookie, /rawToken|tokenHash/);
});

test("POST /api/auth/login returns 429 after configured IP limit is exceeded", async () => {
  const app = createApp({
    authService: createService(),
    authLoginRateLimit: {
      limit: 2,
      windowMinutes: 15,
    },
    enableRequestLogging: false,
    frontendUrl,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", frontendUrl)
      .send({ identifier: user.email, password: "valid-password" });

    assert.equal(response.status, 200);
  }

  const limited = await request(app)
    .post("/api/auth/login")
    .set("Origin", frontendUrl)
    .send({ identifier: user.email, password: "valid-password" });

  assert.equal(limited.status, 429);
  assert.equal(limited.body.errors[0].code, "LOGIN_RATE_LIMITED");
  assert.ok(limited.headers["ratelimit"] || limited.headers["ratelimit-policy"]);
});

test("login-specific limiter does not block ordinary authenticated auth endpoints", async () => {
  const app = createApp({
    authService: createService(),
    authLoginRateLimit: {
      limit: 1,
      windowMinutes: 15,
    },
    enableRequestLogging: false,
    frontendUrl,
  });

  await request(app)
    .post("/api/auth/login")
    .set("Origin", frontendUrl)
    .send({ identifier: user.email, password: "valid-password" })
    .expect(200);

  await request(app)
    .post("/api/auth/login")
    .set("Origin", frontendUrl)
    .send({ identifier: user.email, password: "valid-password" })
    .expect(429);

  const response = await request(app)
    .get("/api/auth/me")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, user);
});

test("GET /api/auth/me returns the authenticated user", async () => {
  const response = await request(
    createApp({
      authService: createService(),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .get("/api/auth/me")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, user);
});

test("POST /api/auth/logout revokes the current session and clears the cookie", async () => {
  let loggedOutSessionId = "";
  const response = await request(
    createApp({
      authService: createService({
        async logout(currentAuth) {
          loggedOutSessionId = currentAuth.sessionId;
        },
      }),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .post("/api/auth/logout")
    .set("Origin", frontendUrl)
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(loggedOutSessionId, "9");
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /Expires=/);
});

test("DELETE /api/auth/sessions/:id can revoke the current session", async () => {
  let revokedSessionId = "";
  const response = await request(
    createApp({
      authService: createService({
        async revokeSession(_auth, sessionId) {
          revokedSessionId = sessionId;
        },
      }),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .delete("/api/auth/sessions/9")
    .set("Origin", frontendUrl)
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(revokedSessionId, "9");
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /Expires=/);
});
