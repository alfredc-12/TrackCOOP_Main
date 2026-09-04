"use client";

import { Modal } from "@/components/ui/Modal";
import { RentalInquiryForm } from "./RentalInquiryForm";
import { RentalInquirySuccess } from "./RentalInquirySuccess";
import type { ReactNode } from "react";
import { useState } from "react";

export function BookRentalModal({ trigger, serviceId, member }: { trigger: ReactNode, serviceId?: string, member?: boolean }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => setSuccess(false), 300);
    }
  };

  return (
    <Modal 
      maxWidth="max-w-4xl" 
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
    >
      <div className="px-1 py-4">
        {success ? (
          <RentalInquirySuccess inModal onDismiss={() => setOpen(false)} />
        ) : (
          <RentalInquiryForm 
            member={member}
            hideBackButton 
            initialServiceId={serviceId} 
            onCancel={() => setOpen(false)} 
            onSuccess={() => setSuccess(true)}
          />
        )}
      </div>
    </Modal>
  );
}
