import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-b border-coop-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-4xl">
        <p className="text-sm font-medium text-coop-muted">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-coop-forest sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-coop-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
