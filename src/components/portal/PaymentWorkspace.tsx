import type { ComponentProps, ComponentType, ReactNode } from "react";
import { StatCard } from "./PortalPrimitives";
import { cn } from "@/lib/utils";

export function PaymentWorkspaceHeader({ title, description, icon: Icon, actions, eyebrow = "Bookkeeper · Payments" }: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return <div className="grid min-w-0 gap-3">
    <header className="relative isolate overflow-hidden rounded-2xl border border-coop-green bg-linear-to-br from-coop-forest to-coop-green p-5 text-white shadow-[var(--coop-shadow-card)] sm:p-6">
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 size-72 rounded-full border-[40px] border-white/5" />
    <div className="flex flex-col gap-5">
      <div className="flex min-w-0 items-start gap-4">
        <span className="hidden size-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 sm:grid"><Icon className="size-6" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80"><span aria-hidden="true" className="size-1.5 rounded-full bg-coop-yellow" />{eyebrow}</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">{description}</p>
        </div>
      </div>
    </div>
    </header>
    {actions ? <div className="min-w-0 text-coop-forest">{actions}</div> : null}
  </div>;
}

export function PaymentSummaryCard({ tone = "green", className, ...props }: ComponentProps<typeof StatCard> & { tone?: "green" | "gold" | "sage" }) {
  const tones = {
    green: "border-t-coop-green [&>div>span]:bg-coop-success-bg [&>div>span]:text-coop-green",
    gold: "border-t-coop-harvest [&>div>span]:bg-coop-warning-bg [&>div>span]:text-coop-warning",
    sage: "border-t-coop-border [&>div>span]:bg-coop-sage [&>div>span]:text-coop-secondary",
  };
  return <StatCard {...props} className={cn("rounded-2xl border-t-[3px] p-4 shadow-coop-soft [&>div>span]:grid [&>div>span]:size-11 [&>div>span]:place-items-center [&>div>span]:rounded-xl", tones[tone], className)} />;
}
