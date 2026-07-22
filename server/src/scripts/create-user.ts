import { hash } from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env";
import { closePool } from "../db/pool";
import { provisionAccount } from "../modules/auth/account-provisioning";
import { AppError } from "../utils/app-error";

const argumentsSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(160),
  role: z.enum(["chairman", "bookkeeper"]),
});

const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters")
  .max(128, "Password must contain at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number");

function parseArguments(values: string[]) {
  const options: Record<string, string> = {};

  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];

    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(
        "Usage: npm run user:create -- --email <email> --name <name> --role <chairman|bookkeeper>",
      );
    }

    options[key.slice(2)] = value;
  }

  const parsed = argumentsSchema.safeParse(options);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    );
  }

  return parsed.data;
}

function readHiddenPassword(prompt: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("An interactive terminal is required to enter the password securely.");
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const input = process.stdin;

    function cleanup() {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
    }

    function onData(data: Buffer | string) {
      for (const character of data.toString()) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Account creation cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    }

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function safeErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    /^(Usage:|An interactive terminal|Account creation cancelled|Passwords do not match)/.test(
      error.message,
    )
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return `Account creation failed (${error.code}).`;
  }

  return "Account creation failed.";
}

async function main() {
  try {
    const input = parseArguments(process.argv.slice(2));
    const password = await readHiddenPassword("Password: ");
    const confirmation = await readHiddenPassword("Confirm password: ");

    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }

    const validatedPassword = passwordSchema.parse(password);
    const passwordHash = await hash(validatedPassword, env.BCRYPT_ROUNDS);
    const account = await provisionAccount({
      email: input.email,
      displayName: input.name,
      role: input.role,
      passwordHash,
    });

    console.info(
      `Created active ${account.role} account for ${account.email} (user ${account.id}).`,
    );
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {
      process.exitCode = 1;
    });
  }
}

void main();
