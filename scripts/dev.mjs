import { spawn } from "node:child_process";
import process from "node:process";

const commands = [
  { name: "WEB", args: ["run", "dev:web"] },
  { name: "API", args: ["run", "dev:api"] },
];

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const commandPrefixArgs = npmCli ? [npmCli] : [];
const children = new Set();
let shuttingDown = false;

function prefixOutput(stream, name, target) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        target.write(`[${name}] ${line}\n`);
      }
    }
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      target.write(`[${name}] ${buffer}\n`);
    }
  });
}

function stopAll(signal = "SIGTERM") {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const item of commands) {
  const child = spawn(command, [...commandPrefixArgs, ...item.args], {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: false,
  });

  children.add(child);
  prefixOutput(child.stdout, item.name, process.stdout);
  prefixOutput(child.stderr, item.name, process.stderr);

  child.on("error", (error) => {
    console.error(`[${item.name}] Failed to start: ${error.message}`);
    stopAll();
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      console.error(`[${item.name}] exited with ${signal ?? `code ${code}`}`);
      stopAll();
      process.exitCode = typeof code === "number" ? code : 1;
    }
  });
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));
