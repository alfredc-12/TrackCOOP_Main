import type { LucideIcon } from "lucide-react";
import { ArrowRight, DatabaseZap } from "lucide-react";
import Link from "next/link";
import { EmptyState, StatusBadge } from "./PortalPrimitives";
import { PageHeader } from "./PageHeader";

type PortalRoutePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: "Ready" | "Next Phase";
  icon?: LucideIcon;
  primaryHref?: string;
  primaryLabel?: string;
};

export function PortalRoutePage({
  eyebrow,
  title,
  description,
  status = "Next Phase",
  icon,
  primaryHref,
  primaryLabel,
}: PortalRoutePageProps) {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <StatusBadge tone={status === "Ready" ? "success" : "warning"}>
            {status}
          </StatusBadge>
        }
      />
      <EmptyState
        icon={icon ?? DatabaseZap}
        title={title}
        description={description}
      />
      {primaryHref && primaryLabel ? (
        <Link
          href={primaryHref}
          className="inline-flex w-fit items-center gap-2 rounded-md bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1F6B43]"
        >
          {primaryLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
