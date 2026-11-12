"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { RentalServiceDetails } from "./RentalServiceDetails";

export function RentalServiceDetailsModal({ serviceId, trigger }: { serviceId: string; trigger: ReactNode }) {
  return (
    <Modal title="Equipment details" maxWidth="max-w-5xl" trigger={trigger}>
      <RentalServiceDetails serviceId={serviceId} embedded />
    </Modal>
  );
}
