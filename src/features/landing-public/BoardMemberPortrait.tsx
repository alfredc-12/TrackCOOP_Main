"use client";

import Image from "next/image";
import { useState } from "react";

export function BoardMemberPortrait({ name, role, image, featured }: { name: string; role: string; image: string; featured: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("");

  return (
    <>
      <div role={failed ? "img" : undefined} aria-label={failed ? `Portrait unavailable for ${name}` : undefined} aria-hidden={!failed || undefined} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#EAF3E8] px-3 text-center text-[#365F4A]">
        <span aria-hidden="true" className="text-4xl font-bold text-[#123D2A] sm:text-5xl">{initials}</span>
        {failed && <span className="text-xs font-medium sm:text-sm">Photo unavailable</span>}
      </div>
      {!failed && <Image src={image} alt={`${name}, ${role}`} fill unoptimized sizes={featured ? "(max-width: 639px) 45vw, 290px" : "(max-width: 639px) 45vw, 250px"} onError={() => setFailed(true)} className="object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />}
    </>
  );
}
