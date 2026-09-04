"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  title?: string;
  description?: string;
  trigger: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Modal({ title, description, trigger, children, maxWidth = "max-w-lg", open, onOpenChange }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[60] bg-transparent focus:outline-none">
          <div className="relative flex h-full items-center justify-center p-4 sm:p-6">
            <Dialog.Close className="absolute inset-0 block h-full w-full cursor-default border-none bg-transparent" aria-label="Close modal" />
            <div className={`relative z-10 flex max-h-full flex-col w-[calc(100vw-2rem)] ${maxWidth} rounded-lg border border-black/10 bg-white p-6 shadow-2xl`}>
              {title ? (
                <div className="flex shrink-0 items-start justify-between gap-4 mb-5">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-[#17211c]">
                      {title}
                    </Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-2 text-sm leading-6 text-[#657169]">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" className="-mr-2 -mt-2" aria-label="Close modal">
                      <X className="size-4" />
                    </Button>
                  </Dialog.Close>
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
              <div className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-6 px-6 -mb-6 pb-6 pt-1">
                {children}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
