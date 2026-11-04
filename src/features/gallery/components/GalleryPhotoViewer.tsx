"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./GalleryPhotoViewer.module.css";

export type GalleryPhoto = { src: string; title: string; caption: string };

export function GalleryPhotoViewer({ photo, onClose, onImageError }: {
  photo: GalleryPhoto;
  onClose: () => void;
  onImageError: (src: string) => void;
}) {
  const [aspectRatio, setAspectRatio] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${styles.overlay} fixed inset-0 z-[9999] bg-black/35 backdrop-blur-2xl`} />
        <div className="pointer-events-none fixed inset-0 z-[10000] grid place-items-center p-3">
          <Dialog.Content
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              closeRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (openerRef.current?.isConnected) openerRef.current.focus();
              else document.getElementById("gallery-photos-heading")?.focus();
            }}
            style={{
              aspectRatio,
              width: `min(calc(100vw - 1.5rem), calc((100dvh - 1.5rem) * ${aspectRatio}))`,
            }}
            className={`${styles.viewer} pointer-events-auto relative max-h-[calc(100dvh-1.5rem)] bg-transparent outline-none`}
          >
            <Dialog.Title className="sr-only">Gallery photo preview</Dialog.Title>
            <Dialog.Description className="sr-only">{photo.caption || photo.title || "Selected cooperative gallery photo."}</Dialog.Description>
            <Image
              src={photo.src}
              alt={photo.title || "Selected cooperative gallery photo"}
              fill
              unoptimized
              loading="eager"
              sizes="100vw"
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight) setAspectRatio(image.naturalWidth / image.naturalHeight);
              }}
              onError={() => onImageError(photo.src)}
              className="rounded-xl object-contain"
            />
            <Dialog.Close ref={closeRef} aria-label="Close gallery photo preview" className="fixed right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-white/30 bg-[#123D2A]/60 text-white shadow-lg transition-colors hover:bg-white hover:text-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X aria-hidden="true" className="size-5" /></Dialog.Close>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
