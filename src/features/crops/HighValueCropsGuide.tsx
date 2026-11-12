"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  HIGH_VALUE_CROP_CRITERIA,
  HIGH_VALUE_CROP_DEFINITION,
  HIGH_VALUE_CROP_NAMES,
} from "./high-value-crops";

type HighValueCropsGuideProps = {
  trigger: ReactNode;
  cropNames?: readonly string[];
  onEdit?: () => void;
};

export function HighValueCropsGuide({
  trigger,
  cropNames = HIGH_VALUE_CROP_NAMES,
  onEdit,
}: HighValueCropsGuideProps) {
  return (
    <Modal
      trigger={trigger}
      title="High-Value Crops"
      description={HIGH_VALUE_CROP_DEFINITION}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-base font-bold text-coop-forest">
            Classification criteria
          </h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-coop-body">
            {HIGH_VALUE_CROP_CRITERIA.map((criterion) => (
              <li key={criterion} className="flex gap-2">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-coop-green"
                  aria-hidden="true"
                />
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-base font-bold text-coop-forest">
            Reference crop list
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {cropNames.map((crop) => (
              <span
                key={crop}
                className="inline-flex rounded-full border border-coop-border bg-coop-subtle px-3 py-1.5 text-xs font-semibold text-coop-green"
              >
                {crop}
              </span>
            ))}
          </div>
        </section>

        <p className="rounded-coop-card border border-[#F2D28B] bg-[#FFF8E8] px-4 py-3 text-sm leading-6 text-[#7A5100]">
          This is the current system reference list. The cooperative can
          finalize or revise the official crop list before production use.
        </p>

        <div className="flex flex-wrap justify-end gap-3 border-t border-coop-border pt-4">
          {onEdit ? (
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" onClick={onEdit}>
                Edit crop list
              </Button>
            </Dialog.Close>
          ) : null}
          <Dialog.Close asChild>
            <Button type="button">Done</Button>
          </Dialog.Close>
        </div>
      </div>
    </Modal>
  );
}
