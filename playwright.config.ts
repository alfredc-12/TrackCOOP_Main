import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "5055";
const webCommand =
  process.env.PLAYWRIGHT_WEB_COMMAND ??
  `npm run dev:web -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: webCommand,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PLAYWRIGHT_API_PORT: apiPort,
      NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}`,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
