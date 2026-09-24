import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function activeEnvKeys(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 1)[0]);
}

test("frontend example exposes only browser-safe NEXT_PUBLIC variables", () => {
  const frontendKeys = activeEnvKeys(source(".env.example"));

  assert.deepEqual(frontendKeys, [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_API_URL",
  ]);
});

test("environment examples do not expose secrets through NEXT_PUBLIC variables", () => {
  const content = [
    source(".env.example"),
    source("server/.env.example"),
    source("docs/deployment-readiness.md"),
  ].join("\n");
  const publicSecretLines = content
    .split(/\r?\n/)
    .filter((line) => /NEXT_PUBLIC_.*(?:SECRET|TOKEN|PASSWORD|ACCESS_KEY|WEBHOOK)/i.test(line));

  assert.deepEqual(publicSecretLines, []);
});

test("API example documents login rate-limit defaults", () => {
  const apiKeys = activeEnvKeys(source("server/.env.example"));

  assert.ok(apiKeys.includes("AUTH_LOGIN_RATE_LIMIT"));
  assert.ok(apiKeys.includes("AUTH_LOGIN_RATE_WINDOW_MINUTES"));
});
