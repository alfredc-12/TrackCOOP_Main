import { Router } from "express";
import { env } from "../../config/env";
import { sendSuccess } from "../../utils/response";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
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
