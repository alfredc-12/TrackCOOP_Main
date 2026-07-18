"use client";

import { useRental } from "../_context/RentalProvider";
import { canAccessRental, type RentalCapability } from "../_lib/rentalPermissions";

export function useRentalPermissions(capability: RentalCapability) {
  const { role } = useRental();
  return { role, allowed: canAccessRental(role, capability) };
}
