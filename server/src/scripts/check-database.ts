import { checkDatabaseSchema } from "../db/schema-check";
import { closePool } from "../db/pool";

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "DATABASE_CHECK_FAILED";
}

async function main() {
  try {
    const result = await checkDatabaseSchema();

    console.info(
      `Database connection succeeded. Found ${result.actualCount} base tables; ${result.expectedCount} TrackCOOP tables are required.`,
    );

    if (result.unexpectedTables.length > 0) {
      console.info(`Additional tables: ${result.unexpectedTables.join(", ")}`);
    }

    if (!result.isComplete) {
      console.error(`Missing tables: ${result.missingTables.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    console.info("All 34 TrackCOOP tables are present.");
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(
      `Database check failed (${errorName}, ${getErrorCode(error)}). Verify server/.env and database access.`,
    );
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {
      process.exitCode = 1;
    });
  }
}

void main();
