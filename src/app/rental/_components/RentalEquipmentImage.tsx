"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveUploadUrl } from "@/lib/upload-url";

export function RentalEquipmentImage({ path, name }: { path?: string; name: string }) {
  const [failedPath, setFailedPath] = useState<string>();
  const src = resolveUploadUrl(path);
  return (
    <div className="rental-public-media relative aspect-[4/3] overflow-hidden rounded-lg bg-[#E7ECE4]">
      {src && failedPath !== src ? <Image src={src} alt={name} fill unoptimized sizes="(min-width:640px) 176px, 100vw" className="object-cover" onError={() => setFailedPath(src)} /> : <div role="img" aria-label={name} className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-[#365F4A]">Photo unavailable</div>}
    </div>
  );
}
