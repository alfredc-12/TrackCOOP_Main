"use client";

import type { RentalCapability } from "../_lib/rentalPermissions";
import { useRentalPermissions } from "../_hooks/useRentalPermissions";
import { RentalPermissionState } from "./RentalStates";

export function RentalAccessGate({ capability, children }: { capability: RentalCapability; children: React.ReactNode }) {
  const { allowed, role } = useRentalPermissions(capability);
  return allowed ? children : <RentalPermissionState role={role} />;
}
