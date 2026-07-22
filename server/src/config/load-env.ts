import path from "node:path";
import { config as loadEnv } from "dotenv";

let loaded = false;

function getServerEnvPath() {
  const cwd = process.cwd();
  const isServerDirectory = path.basename(cwd).toLowerCase() === "server";

  return isServerDirectory
    ? path.resolve(cwd, ".env")
    : path.resolve(cwd, "server", ".env");
}

export function loadServerEnv() {
  if (loaded) {
    return;
  }

  loadEnv({
    path: getServerEnvPath(),
    quiet: true,
  });

  loaded = true;
}
