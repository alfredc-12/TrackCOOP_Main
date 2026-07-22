import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  FileUp,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6C7A70]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[#123D2A]">{value}</p>
        </div>
        <span className="grid size-11 place-items-center rounded-lg bg-[#E7F2E4] text-[#1F6B43]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
      <h2 className="text-sm font-bold text-[#123D2A]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-[#EEF2EC] text-[#365F4A]",
    success: "bg-[#E3F7E7] text-[#1F6B43]",
    warning: "bg-[#FFF4D7] text-[#8A6200]",
    danger: "bg-[#FFE6E0] text-[#9A392A]",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

export function SearchAndFilters({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
        <input
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder="Search"
          type="search"
        />
      </label>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-[#6C7A70]">{hint}</span> : null}
    </label>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[88vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-6 shadow-[0_24px_70px_rgba(18,61,42,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black text-[#123D2A]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-sm leading-6 text-[#5D6D63]">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC]">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  trigger?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#CAD8CB] bg-white p-6 text-center shadow-[0_24px_70px_rgba(18,61,42,0.22)]">
          <span className="mx-auto grid size-12 place-items-center rounded-lg bg-[#FFF4D7] text-[#8A6200]">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <Dialog.Title className="mt-4 text-xl font-black text-[#123D2A]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[#5D6D63]">
            {description}
          </Dialog.Description>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Dialog.Close className="rounded-md border border-[#CAD8CB] bg-white px-4 py-2.5 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]">
              {cancelLabel}
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1F6B43]"
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[18rem] place-items-center rounded-lg border border-dashed border-[#B9CABD] bg-white/65 p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-[#E7F2E4] text-[#1F6B43]">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-black text-[#123D2A]">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#5D6D63]">{description}</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-28 animate-pulse rounded-lg bg-[#E7F2E4]" />
      <div className="h-52 animate-pulse rounded-lg bg-[#EEF2EC]" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-4 text-sm text-[#7A3023]">
      {message}
    </div>
  );
}

export function FileUploader() {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-[#B9CABD] bg-white p-6 text-center">
      <div>
        <FileUp className="mx-auto size-6 text-[#1F6B43]" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-[#123D2A]">Upload file</p>
      </div>
    </div>
  );
}

export function DateRangeFilter() {
  return (
    <button className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-semibold text-[#294B39] transition hover:bg-[#F7F8F3]">
      <CalendarDays className="size-4" aria-hidden="true" />
      Date range
      <ChevronDown className="size-4" aria-hidden="true" />
    </button>
  );
}

export function CurrencyDisplay({ value }: { value: number }) {
  return (
    <span className="font-bold tabular-nums text-[#123D2A]">
      {new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(value)}
    </span>
  );
}

export function LoadingAccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F8F3] text-[#123D2A]">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        Verifying access...
      </div>
    </main>
  );
}
