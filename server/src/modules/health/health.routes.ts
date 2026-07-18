import { Router } from "express";
import { env } from "../../config/env";
import { probeDatabase } from "../../db/pool";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";

export type DatabaseProbe = () => Promise<{ latencyMs: number }>;

export function createHealthRouter(databaseProbe: DatabaseProbe = probeDatabase) {
  const router = Router();

  router.get("/", (_request, response) => {
    return sendSuccess(
      response,
      {
        status: "ok",
        service: "trackcoop-api",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
      { message: "API is healthy" },
    );
  });

  router.get(
    "/database",
    asyncHandler(async (_request, response) => {
      try {
        const result = await databaseProbe();

        return sendSuccess(
          response,
          {
            status: "ok",
            latencyMs: result.latencyMs,
          },
          { message: "Database is reachable" },
        );
      } catch {
        throw new AppError(
          "Database is unavailable",
          503,
          "DATABASE_UNAVAILABLE",
        );
      }
    }),
  );

  return router;
}
