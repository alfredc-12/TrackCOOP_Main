import { AppError } from "../../utils/app-error";
import type { ShareCapitalStatus, UpdateShareCapitalInput } from "./share-capital.types";

const immutableAfterValidation = [
  "memberId",
  "paymentReferenceId",
  "amount",
  "paymentDate",
] as const satisfies readonly (keyof UpdateShareCapitalInput)[];

export function assertShareCapitalPaymentUpdateAllowed(
  currentStatus: ShareCapitalStatus,
  input: UpdateShareCapitalInput,
) {
  if (currentStatus !== "Validated") return;

  const changesImmutableValue = immutableAfterValidation.some(
    (field) => input[field] !== undefined,
  );
  const nextStatus = input.paymentStatus;

  if (changesImmutableValue || (nextStatus !== undefined && nextStatus !== "Validated" && nextStatus !== "Reversed")) {
    throw new AppError(
      "Validated Share Capital payments cannot change member, reference, amount, or payment date. Reverse the payment first.",
      409,
      "SHARE_CAPITAL_VALIDATED_IMMUTABLE",
    );
  }
}
