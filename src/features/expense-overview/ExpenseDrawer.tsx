"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * One drawer at a time. Right-hand drawers hold detail; the left-hand drawer holds the category by source
 * comparison. On phones either becomes a bottom sheet. Radix supplies the focus trap, Escape and the
 * return of focus to the control that opened it.
 */
export function ExpenseDrawer({ open, onClose, side = "right", title, description, wide, children }: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  // The drawers open from cards, bars and rows rather than from a Dialog trigger, so remember what had
  // focus when this one mounted and give it back on close (without scrolling the page).
  const [opener] = useState<HTMLElement | null>(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0B2A1C]/40" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener?.isConnected) opener.focus({ preventScroll: true });
          }}
          className={`fixed z-[60] flex flex-col bg-white shadow-[0_0_48px_rgba(18,61,42,0.28)] outline-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-2xl sm:inset-y-0 ${side === "right" ? "sm:right-0" : "sm:left-0"} ${wide ? "sm:w-[min(100vw,60rem)]" : "sm:w-[min(100vw,42rem)]"}`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D9E4DA] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-black leading-6 text-[#123D2A]">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm leading-5 text-[#5D6D63]">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close panel" className="grid size-11 shrink-0 place-items-center rounded-md text-[#365F4A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
