import { AppError } from "../../utils/app-error";
export type ControlledFinanceMode = "Inactive" | "StagingVerified" | "Active";
// No configuration, input, environment variable or route can change this in PR 1C.
export function controlledFinanceMode(): ControlledFinanceMode { return "Inactive"; }
export function assertLegacyFinanceWriteAllowed(mode: ControlledFinanceMode) {
  if (mode === "Active") throw new AppError("Use the protected financial workflow",409,"POLICY_ENFORCEMENT_REQUIRED");
}
