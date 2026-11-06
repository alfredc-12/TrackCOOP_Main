"use client";

import { UserRound } from "lucide-react";

export function BoardMemberPortrait({ name, role }: { name: string; role: string }) {
  return (
    <div
      role="img"
      aria-label={`Profile placeholder for ${name}, ${role}`}
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#EAF3E8] px-3 text-center text-[#365F4A]"
    >
      <span className="grid size-20 place-items-center rounded-full border border-[#C9DDCE] bg-white/75 text-[#1F6B43] shadow-sm sm:size-24">
        <UserRound aria-hidden="true" className="size-10 sm:size-12" strokeWidth={1.7} />
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#497158] sm:text-sm">
        Board member
      </span>
    </div>
  );
}
