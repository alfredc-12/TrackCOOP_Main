import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const binaryExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mov", ".avi",
]);

const patterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "PayMongo secret key", pattern: /\bsk_(?:test|live)_[A-Za-z0-9]{12,}\b/g },
  { name: "PayMongo webhook secret", pattern: /\bwhsec_[A-Za-z0-9]{12,}\b/g },
  { name: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "GitHub token", pattern: /\bgh[opsu]_[A-Za-z0-9]{30,}\b/g },
];

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

const findings: string[] = [];
for (const relativePath of trackedFiles()) {
  if (ignored.has(relativePath) || relativePath.endsWith(".env.example")) continue;
  if (relativePath === "scripts/scan-secrets.ts") continue;
  const extension = path.extname(relativePath).toLowerCase();
  if (binaryExtensions.has(extension)) continue;

  const absolutePath = path.join(root, relativePath);
  if (!statSync(absolutePath).isFile()) continue;
  const content = readFileSync(absolutePath, "utf8");

  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(`${relativePath}:${line}: possible ${name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential committed secrets were found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.info("Secret scan passed: no high-confidence committed secrets found.");
}
