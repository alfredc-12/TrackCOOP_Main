import type { ComponentProps, ComponentType, ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { StatCard } from "./PortalPrimitives";
import { cn } from "@/lib/utils";

export function PaymentWorkspaceHeader({ title, description, actions, eyebrow }: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
    />
  );
}

export function PaymentSummaryCard({ tone = "green", className, showTopBorder = false, ...props }: ComponentProps<typeof StatCard> & { tone?: "green" | "gold" | "sage"; showTopBorder?: boolean }) {
  const tones = {
    green: { border: "border-t-coop-green", icon: "[&>div>span]:bg-coop-success-bg [&>div>span]:text-coop-green" },
    gold: { border: "border-t-coop-harvest", icon: "[&>div>span]:bg-coop-warning-bg [&>div>span]:text-coop-warning" },
    sage: { border: "border-t-coop-border", icon: "[&>div>span]:bg-coop-sage [&>div>span]:text-coop-secondary" },
  };
  return <StatCard {...props} className={cn("rounded-2xl p-4 shadow-coop-soft [&>div>span]:grid [&>div>span]:size-11 [&>div>span]:place-items-center [&>div>span]:rounded-xl", showTopBorder && "border-t-[3px]", showTopBorder && tones[tone].border, tones[tone].icon, className)} />;
}
