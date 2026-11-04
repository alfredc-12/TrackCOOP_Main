"use client";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRef, useState } from "react";
import { resolveUploadUrl } from "@/lib/upload-url";
export type LandingPhoto = {
  id: string;
  imagePath: string;
  altText: string;
  position: number;
};
export function LandingPhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
  onFailed,
  opener,
}: {
  photos: LandingPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onFailed: (id: string) => void;
  opener: HTMLElement | null;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const [ratio, setRatio] = useState(1);
  const photo = photos[index];
  function navigate(delta: number) {
    onIndex((index + delta + photos.length) % photos.length);
  }
  if (!photo) return null;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay onClick={onClose} className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-xl motion-reduce:backdrop-blur-none" />
        <Dialog.Content
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 outline-none sm:p-12"
          onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            close.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              navigate(1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              navigate(-1);
            }
          }}
        >
          <Dialog.Title className="sr-only">
            Cooperative photo {index + 1} of {photos.length}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {photo.altText}
          </Dialog.Description>
          <Image
            key={photo.id}
            src={resolveUploadUrl(photo.imagePath)}
            alt={photo.altText}
            width={1800}
            height={1400}
            unoptimized
            loading="eager"
            className="pointer-events-auto h-auto max-h-[calc(100dvh-5rem)] max-w-full rounded-xl object-contain"
            style={{
              width: `min(calc(100vw - 2rem),calc((100dvh - 5rem) * ${ratio}))`,
              aspectRatio: ratio,
            }}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight)
                setRatio(image.naturalWidth / image.naturalHeight);
            }}
            onError={() => onFailed(photo.id)}
          />
          <Dialog.Close
            ref={close}
            aria-label="Close photo preview"
            className="pointer-events-auto fixed right-4 top-4 grid size-11 place-items-center rounded-full bg-[#123d2a] text-white outline-offset-4 hover:bg-white hover:text-[#123d2a] focus-visible:outline-2 focus-visible:outline-white"
          >
            <X aria-hidden="true" />
          </Dialog.Close>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => navigate(-1)}
                className="pointer-events-auto fixed left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-[#123d2a]/90 text-white hover:bg-white hover:text-[#123d2a] focus-visible:outline-2 focus-visible:outline-white sm:left-6"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => navigate(1)}
                className="pointer-events-auto fixed right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-[#123d2a]/90 text-white hover:bg-white hover:text-[#123d2a] focus-visible:outline-2 focus-visible:outline-white sm:right-6"
              >
                <ArrowRight aria-hidden="true" />
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
