import { defineConfig, devices } from "@playwright/test";

const run = process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run";
if (!/^database-[a-z0-9-]+$/.test(run)) throw new Error("Invalid evidence run directory");
const output = `evidence/playwright/${run}`;
// Start the isolated services described in evidence/playwright/README.md first.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["evidence-database.spec.ts", "evidence-investigation.spec.ts", "evidence-payments.spec.ts", "evidence-gateway.spec.ts", "evidence-operations.spec.ts", "evidence-analytics.spec.ts", "evidence-interactions.spec.ts", "evidence-safe.spec.ts", "evidence-screenshots.spec.ts", "evidence-activities.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: `${output}/test-results`,
  reporter: [["list"], ["html", { outputFolder: `${output}/html-report`, open: "never" }], ["json", { outputFile: `${output}/results.json` }]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3217", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
