import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "server/dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "scratch/**",
    "evidence/playwright/database-*/**",
    "evidence/playwright/initial/**",
    // Generated JMeter dashboards bundle third-party browser libraries.
    "evidence/jmeter/**/html-report/**",
    "next-env.d.ts",
  ]),
  {
    files: ["evidence/jmeter/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
