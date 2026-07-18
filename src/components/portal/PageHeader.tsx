import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-[#CAD8CB] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#D8A011]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#123D2A] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5D6D63]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
