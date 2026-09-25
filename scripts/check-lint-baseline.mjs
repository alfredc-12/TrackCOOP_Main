import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(repoRoot, "eslint-baseline.json");
const eslintBin = path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
const shouldUpdate = process.argv.includes("--update");

function emptySummary() {
  return {
    version: 1,
    generatedFrom: "npm run lint:baseline:update",
    totals: { errors: 0, warnings: 0 },
    allowances: {},
  };
}

function normalizeFile(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function addAllowance(summary, file, severity, rule) {
  summary.allowances[file] ??= {};
  summary.allowances[file][severity] ??= {};
  summary.allowances[file][severity][rule] =
    (summary.allowances[file][severity][rule] ?? 0) + 1;
}

function summarize(results) {
  const summary = emptySummary();

  for (const result of results) {
    const file = normalizeFile(result.filePath);

    for (const message of result.messages) {
      if (message.severity !== 1 && message.severity !== 2) continue;

      const severity = message.severity === 2 ? "error" : "warning";
      const rule = message.ruleId ?? "<no-rule>";
      addAllowance(summary, file, severity, rule);

      if (severity === "error") summary.totals.errors += 1;
      else summary.totals.warnings += 1;
    }
  }

  const sortedAllowances = {};
  for (const file of Object.keys(summary.allowances).sort()) {
    sortedAllowances[file] = {};
    for (const severity of ["error", "warning"]) {
      const rules = summary.allowances[file][severity];
      if (!rules) continue;
      sortedAllowances[file][severity] = Object.fromEntries(
        Object.entries(rules).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
  }
  summary.allowances = sortedAllowances;

  return summary;
}

function countAllowed(baseline, file, severity, rule) {
  return baseline.allowances?.[file]?.[severity]?.[rule] ?? 0;
}

const eslint = spawnSync(
  process.execPath,
  [eslintBin, ".", "--format", "json"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);

if (eslint.error) {
  console.error("Unable to start ESLint:", eslint.error.message);
  process.exit(2);
}

if ((eslint.status ?? 2) > 1) {
  process.stderr.write(eslint.stderr || "");
  console.error(`ESLint could not complete (exit ${eslint.status}).`);
  process.exit(eslint.status ?? 2);
}

let results;
try {
  results = JSON.parse(eslint.stdout || "[]");
} catch (error) {
  process.stderr.write(eslint.stderr || "");
  console.error("Could not parse ESLint JSON output:", error);
  process.exit(2);
}

const current = summarize(results);

if (shouldUpdate) {
  current.generatedFrom = `npm run lint:baseline:update on ${new Date().toISOString()}`;
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `Updated eslint-baseline.json: ${current.totals.errors} errors, ${current.totals.warnings} warnings.`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    "eslint-baseline.json is missing. Run npm run lint:baseline:update intentionally to create it.",
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const increases = [];

for (const [file, severities] of Object.entries(current.allowances)) {
  for (const [severity, rules] of Object.entries(severities)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = countAllowed(baseline, file, severity, rule);
      if (count > allowed) {
        increases.push({
          file,
          severity,
          rule,
          allowed,
          current: count,
          added: count - allowed,
        });
      }
    }
  }
}

console.log(
  `Lint baseline: current ${current.totals.errors} errors / ${current.totals.warnings} warnings; ` +
  `baseline ${baseline.totals.errors} errors / ${baseline.totals.warnings} warnings.`,
);

if (increases.length > 0) {
  console.error("\nNew lint debt detected:");
  for (const item of increases) {
    console.error(
      `- ${item.file} [${item.severity}] ${item.rule}: ` +
      `${item.current} current, ${item.allowed} allowed (+${item.added})`,
    );
  }
  console.error(
    "\nFix the new lint findings. Only refresh the baseline when intentionally accepting existing debt.",
  );
  process.exit(1);
}

if (
  current.totals.errors < baseline.totals.errors ||
  current.totals.warnings < baseline.totals.warnings
) {
  console.log(
    "Lint debt decreased. Consider running npm run lint:baseline:update in a dedicated cleanup change.",
  );
}

console.log("Lint baseline passed: no file/rule/severity count increased.");
