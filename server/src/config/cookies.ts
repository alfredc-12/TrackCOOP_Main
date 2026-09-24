import type { CookieOptions } from "express";
import { env } from "./env";

function cookieDomain() {
  if (!env.SESSION_COOKIE_DOMAIN) return undefined;
  if (env.SESSION_COOKIE_DOMAIN.includes("localhost")) return undefined;
  return env.SESSION_COOKIE_DOMAIN;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: env.SESSION_COOKIE_SAME_SITE,
    domain: cookieDomain(),
    path: "/",
  };
}

