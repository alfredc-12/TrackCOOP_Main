"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RentalStatusLookup } from "./RentalStatusLookup";
import { readRentalStatusLink } from "../_lib/rentalStatusLink";

/**
 * Opens the "Check Booking Status" dialog over whatever rental page the visitor lands on:
 *   /rental?booking=RNT-2026-0042&k=<signed token>   from an email: the status loads by itself
 *   /rental?check=1                                  an empty dialog (the old status page redirects here)
 * Closing it removes the parameters, so the token does not stay in the address bar or the history.
 */
export function RentalStatusLinkModal() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const link = readRentalStatusLink(params);
  const [dismissed, setDismissed] = useState("");

  if (!link) return null;
  const key = `${link.reference}|${link.token ?? ""}|${link.check ? 1 : 0}`;

  return (
    <Modal
      open={dismissed !== key}
      onOpenChange={(open) => {
        if (open) return;
        setDismissed(key);
        router.replace(pathname, { scroll: false });
      }}
      title="Check Booking Status"
      description={link.token ? "Here is the latest status of your booking." : "Enter your Booking ID to check the current status."}
      maxWidth="max-w-2xl"
      trigger={<span className="hidden" aria-hidden="true" />}
    >
      <RentalStatusLookup key={key} initial={link.reference || link.token ? { reference: link.reference, token: link.token } : undefined} />
    </Modal>
  );
}
