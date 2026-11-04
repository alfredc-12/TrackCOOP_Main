"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findPortalNavItem, getPortalRoleFromPath, roleHomePaths } from "./navigation";

function titleize(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const role = getPortalRoleFromPath(pathname);
  const current = findPortalNavItem(pathname);

  if (!role) return null;

  const segments = pathname.split("/").filter(Boolean).slice(1);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-coop-muted">
      <Link href={roleHomePaths[role]} className="transition hover:text-coop-forest">
        {titleize(role)}
      </Link>
      {segments.length ? <span className="text-[#AFC1B2]">/</span> : null}
      <span className="text-coop-forest">{current?.label ?? titleize(segments.at(-1) ?? "Dashboard")}</span>
    </nav>
  );
}
