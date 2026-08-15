import type { RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { publicStatusParamsSchema } from "./membership-application.schema";
import type { MembershipApplicationService } from "./membership-application.service";
import type { PublicMembershipPaymentService } from "./membership-application.public-payment.service";

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

export function createPublicMembershipApplicationStatusHandler(
  applicationService: MembershipApplicationService,
  paymentService: PublicMembershipPaymentService,
): RequestHandler {
  return asyncHandler(async (request, response) => {
    const params = publicStatusParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError(params.error);
    const dateOfBirth = request.get("X-Application-Date-Of-Birth");

    const [application, payments] = await Promise.all([
      applicationService.getPublicStatus(
        params.data.applicationCode,
        dateOfBirth,
      ),
      paymentService.getSummary(
        params.data.applicationCode,
        dateOfBirth,
      ),
    ]);

    return sendSuccess(response, {
      ...application,
      ...payments,
    });
  });
}
