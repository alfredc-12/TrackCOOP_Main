"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

export function RentalBreadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean).slice(1);
  if (!segments.length) return null;
  return <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-xs font-semibold text-[#708078]"><Link href="/rental/dashboard" className="hover:text-[#123d2a]">Rental</Link>{segments.map((segment, index) => { const href = `/rental/${segments.slice(0, index + 1).join("/")}`; const label = decodeURIComponent(segment).replaceAll("-", " "); return <span key={href} className="flex items-center gap-1"><ChevronRight className="size-3.5" />{index === segments.length - 1 ? <span className="capitalize text-[#365f4a]">{label}</span> : <Link href={href} className="capitalize hover:text-[#123d2a]">{label}</Link>}</span>; })}</nav>;
}
