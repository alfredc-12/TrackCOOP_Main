"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  trigger?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  mobileFullScreen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Modal({ title, description, headerActions, trigger, children, maxWidth = "max-w-lg", mobileFullScreen = false, open, onOpenChange }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[60] bg-transparent focus:outline-none">
          <div className={`relative flex h-full items-center justify-center ${mobileFullScreen ? "p-0 sm:p-6" : "p-4 sm:p-6"}`}>
            <Dialog.Close className="absolute inset-0 block h-full w-full cursor-default border-none bg-transparent" aria-label="Close modal" />
            <div className={`relative z-10 flex min-w-0 flex-col bg-coop-surface ${mobileFullScreen ? `h-full w-full max-h-none border-0 p-4 shadow-none sm:h-auto sm:max-h-full sm:w-[calc(100vw-2rem)] sm:rounded-coop-dialog sm:border sm:p-6 sm:shadow-coop-floating ${maxWidth}` : `max-h-full w-[calc(100vw-2rem)] ${maxWidth} rounded-coop-dialog border border-coop-border p-6 shadow-coop-floating`}`}>
              {title ? (
                <div className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-xl font-semibold text-coop-ink">
                      {title}
                    </Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-2 text-sm leading-6 text-[#657169]">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {headerActions}
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="sm" className="-mr-2 -mt-2" aria-label="Close modal">
                        <X className="size-4" />
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
              ) : (
                <>
                  <Dialog.Title className="sr-only">Modal Dialog</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" className="absolute right-4 top-4 z-50 text-[#6b786f] hover:bg-[#f1f4ef]" aria-label="Close modal">
                      <X className="size-4" />
                    </Button>
                  </Dialog.Close>
                </>
              )}
              <div className={`min-h-0 overflow-y-auto -mx-6 px-6 -mb-6 pb-6 pt-1 ${mobileFullScreen ? "flex-1 sm:flex-none" : ""}`}>
                {children}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
