import express, { Router } from "express";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  createPaymongoWebhookService,
  type PaymongoWebhookService,
} from "./paymongo.webhook.service";

function rawBody(value: unknown) {
  if (!Buffer.isBuffer(value)) {
    throw new AppError("Webhook body must be raw JSON", 400, "PAYMONGO_WEBHOOK_RAW_BODY_REQUIRED");
  }
  return value;
}

export function createPaymongoWebhookRouter(
  webhookService: PaymongoWebhookService = createPaymongoWebhookService(),
) {
  const router = Router();

  router.post(
    "/",
    express.raw({ type: "application/json" }),
    asyncHandler(async (request, response) => {
      const result = await webhookService.handleWebhook({
        rawBody: rawBody(request.body),
        signatureHeader: request.get("Paymongo-Signature"),
      });

      return sendSuccess(response, result, {
        message: "PayMongo webhook accepted",
      });
    }),
  );

  return router;
}
