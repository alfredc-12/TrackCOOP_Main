import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function RentalPageHeader({ eyebrow = "Rental Management", title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode | { href: string; label: string; icon?: LucideIcon } }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#497158]">{eyebrow}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#123d2a] sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d6d62] sm:text-base">{description}</p>}</div>{action && (typeof action === 'object' && 'href' in (action as any) ? (() => { const A = action as { href: string; label: string; icon?: LucideIcon }; return <Link href={A.href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f6b43] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#174e33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b43]">{A.icon && <A.icon className="size-4" />}{A.label}</Link>; })() : action as ReactNode)}</div>;
}
