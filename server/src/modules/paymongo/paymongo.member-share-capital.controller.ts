import { ZodError } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { paymongoMemberShareCapitalCheckoutBodySchema } from "./paymongo.schema";
import type { PaymongoMemberShareCapitalService } from "./paymongo.member-share-capital.service";

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function validationError(error: ZodError) {
  return new AppError(
    "The request payload is invalid",
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

export function createPaymongoMemberShareCapitalController(
  service: PaymongoMemberShareCapitalService,
) {
  return {
    summary: asyncHandler(async (request, response) => {
      const result = await service.getSummary(requireAuth(request.auth));
      return sendSuccess(response, result);
    }),

    checkout: asyncHandler(async (request, response) => {
      const parsed = paymongoMemberShareCapitalCheckoutBodySchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error);
      const result = await service.createCheckout(
        parsed.data,
        requireAuth(request.auth),
      );
      return sendSuccess(response, result, {
        statusCode: result.reused ? 200 : 201,
        message: result.reused
          ? "Existing Member Share Capital checkout returned"
          : "Member Share Capital checkout session created",
      });
    }),
  };
}
