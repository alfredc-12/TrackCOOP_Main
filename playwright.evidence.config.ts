import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "evidence-safe.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: "evidence/playwright/test-results",
  reporter: [["list"], ["html", { outputFolder: "evidence/playwright/html-report", open: "never" }], ["json", { outputFile: "evidence/playwright/results.json" }]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3217", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3217",
    url: "http://127.0.0.1:3217/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:3218" },
  },
});
