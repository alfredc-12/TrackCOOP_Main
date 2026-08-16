"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  title: string;
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
        <Dialog.Content className="fixed inset-0 z-[60] overflow-y-auto bg-transparent focus:outline-none">
          <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
            <Dialog.Close className="absolute inset-0 block h-full w-full cursor-default border-none bg-transparent" aria-label="Close modal" />
            <div className={`relative z-10 w-[calc(100vw-2rem)] ${maxWidth} rounded-lg border border-black/10 bg-white p-6 shadow-2xl`}>
              <div className="flex items-start justify-between gap-4">
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
                  <Button variant="ghost" size="sm" aria-label="Close modal">
                    <X className="size-4" />
                  </Button>
                </Dialog.Close>
              </div>
              <div className="mt-5">{children}</div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
