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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RetryButton } from "@/components/ui/RetryButton";
import { StyledSelect } from "@/components/ui/StyledSelect";

export { LoadingSpinner, LoadingButton, SkeletonCard, SkeletonTable, LoadingOverlay } from "@/components/ui/LoadingStates";

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "compact";
  className?: string;
  valueClassName?: string;
}) {
  if (variant === "compact") {
    return (
      <article className={cn("coop-panel p-4", className)}>
        <div className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#EEF6EC] text-coop-green">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-coop-muted">{label}</p>
            <p className="mt-1 break-words text-2xl font-bold leading-tight tabular-nums text-coop-forest">{value}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className={cn("coop-panel p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-5 text-coop-muted">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums text-coop-forest", valueClassName ?? "break-words")}>{value}</p>
        </div>
        <span className="shrink-0 text-coop-green">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="coop-panel p-5">
      <h2 className="text-base font-semibold text-coop-forest">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-coop-subtle text-coop-secondary",
    success: "bg-coop-success-bg text-coop-green",
    warning: "bg-coop-warning-bg text-coop-warning",
    danger: "bg-coop-danger-bg text-coop-danger",
  };

  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function SearchAndFilters({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-coop-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
        <input
          className="h-11 w-full rounded-md border border-coop-border bg-coop-workspace pl-10 pr-4 text-sm outline-none transition focus:border-coop-green focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder="Search"
          aria-label="Search records"
          type="search"
        />
      </label>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="coop-panel w-full max-w-full overflow-hidden">
      <div role="region" aria-label="Data table, scroll horizontally for more columns" tabIndex={0} className="coop-table w-full min-w-0 max-w-full overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
  hint,
  required,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-coop-body">
      <span className="flex items-center gap-1">
        {label}
        {required ? <span className="text-coop-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-sm font-normal text-coop-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[#6C7A70]">{hint}</span>
      ) : null}
    </label>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  contentClassName,
  bodyClassName,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  trigger?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[60] overflow-y-auto custom-scrollbar bg-transparent focus:outline-none">
          <div className="relative flex min-h-full items-center justify-center p-2 sm:p-4 py-4 sm:py-6">
            <Dialog.Close className="absolute inset-0 block h-full w-full cursor-default border-none bg-transparent" aria-label="Close modal" />
            <div
              className={cn(
                "relative z-10 w-[min(38rem,calc(100vw-2rem))] rounded-lg border border-coop-border bg-white p-4 sm:p-5 shadow-[0_24px_70px_rgba(18,61,42,0.22)]",
                contentClassName,
              )}
            >
              <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-start justify-between gap-4 bg-white px-4 pb-3 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="break-words text-xl font-black text-coop-forest">{title}</Dialog.Title>
                  {description ? (
                    <Dialog.Description className="mt-2 text-sm leading-6 text-coop-muted">
                      {description}
                    </Dialog.Description>
                  ) : null}
                </div>
                <Dialog.Close aria-label="Close dialog" className="coop-icon-button grid size-11 shrink-0 place-items-center rounded-coop-control border border-coop-border text-coop-forest transition hover:bg-coop-subtle">
                  <X className="size-4" aria-hidden="true" />
                </Dialog.Close>
              </div>
              <div className={cn("mt-2", bodyClassName)}>{children}</div>
            </div>
          </div>
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
  loading = false,
  cancelLabel = "Cancel",
  variant = "warning",
  onConfirm,
  trigger,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  onConfirm: () => void;
  trigger?: ReactNode;
  children?: ReactNode;
}) {
  const isDanger = variant === "danger";
  const Icon = isDanger ? Trash2 : AlertCircle;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[60] overflow-y-auto custom-scrollbar bg-transparent focus:outline-none">
          <div className="relative flex min-h-full items-center justify-center p-4 py-12">
            <Dialog.Close disabled={loading} className="absolute inset-0 block h-full w-full cursor-default border-none bg-transparent disabled:pointer-events-none" aria-label="Close modal" />
            <div
              className={cn(
                "relative z-10 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white text-center shadow-[0_24px_70px_rgba(18,61,42,0.22)]",
                isDanger ? "border-[#E7B8A8]" : "border-coop-border",
              )}
            >
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-24",
                  isDanger
                    ? "bg-[linear-gradient(180deg,rgba(255,244,236,0.95),rgba(255,255,255,0))]"
                    : "bg-[linear-gradient(180deg,rgba(255,244,215,0.85),rgba(255,255,255,0))]",
                )}
                aria-hidden="true"
              />
              <div className="relative p-6 sm:p-7">
              <span
                className={cn(
                  "mx-auto grid size-14 place-items-center rounded-2xl border shadow-[0_12px_30px_rgba(18,61,42,0.10)]",
                  isDanger
                    ? "border-[#E7B8A8] bg-[#FFF4EC] text-coop-danger"
                    : "border-[#F2D89A] bg-coop-warning-bg text-coop-warning",
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <Dialog.Title className="mx-auto mt-5 max-w-[18rem] text-balance text-2xl font-black leading-tight text-coop-forest">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mx-auto mt-3 max-w-[22rem] text-sm leading-6 text-coop-muted">
                {description}
              </Dialog.Description>
              {children ? <div className="mt-4 text-left">{children}</div> : null}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Dialog.Close disabled={loading} className="min-h-12 rounded-lg border border-coop-border bg-white px-4 py-2.5 text-sm font-black text-coop-body transition hover:border-[#9FB7A4] hover:bg-coop-subtle focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/20 disabled:cursor-not-allowed disabled:opacity-50">
                  {cancelLabel}
                </Dialog.Close>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className={cn(
                    "min-h-12 rounded-lg px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(18,61,42,0.18)] transition focus:outline-none focus:ring-2",
                    isDanger
                      ? "bg-[#8F2F25] hover:bg-[#73251D] focus:ring-[#E7B8A8]"
                      : "bg-coop-forest hover:bg-coop-green focus:ring-[#1F6B43]/25",
                  )}
                >
                  {loading ? "Processing..." : confirmLabel}
                </button>
              </div>
              </div>
            </div>
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
    <div className="coop-panel grid min-h-40 place-items-center p-6 text-center">
      <div>
        <span className="mx-auto block w-fit text-coop-green">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-black text-coop-forest">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-coop-muted">{description}</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite" aria-label="Loading content">
      <div className="h-28 animate-pulse rounded-lg bg-[#E7F2E4]" />
      <div className="h-52 animate-pulse rounded-lg bg-coop-subtle" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-4 text-sm text-[#7A3023]">
      <p>{message}</p>
      {onRetry ? <RetryButton onRetry={onRetry} /> : null}
    </div>
  );
}

export function FileUploader() {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-[#B9CABD] bg-white p-6 text-center">
      <div>
        <FileUp className="mx-auto size-6 text-coop-green" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-coop-forest">Upload file</p>
      </div>
    </div>
  );
}

export function DateRangeFilter() {
  return (
    <button className="inline-flex h-11 items-center gap-2 rounded-md border border-coop-border bg-white px-4 text-sm font-semibold text-coop-body transition hover:bg-coop-workspace">
      <CalendarDays className="size-4" aria-hidden="true" />
      Date range
      <ChevronDown className="size-4" aria-hidden="true" />
    </button>
  );
}

export function CurrencyDisplay({ value }: { value: number }) {
  return (
    <span className="font-bold tabular-nums text-coop-forest">
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
    <main className="grid min-h-screen place-items-center bg-coop-workspace text-coop-forest">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        Verifying access...
      </div>
    </main>
  );
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemName = "items",
  onPageChange,
  pageSize,
  pageSizeOptions = [5, 10, 20],
  onPageSizeChange,
  centerControls = false,
  className,
  disabled = false,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemName?: string;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  centerControls?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const start = pageSize && totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = pageSize ? Math.min(currentPage * pageSize, totalItems) : 0;
  return (
    <nav aria-label="Table pagination" className={cn("mt-6 gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between", pageSize && onPageSizeChange ? "grid grid-cols-[minmax(0,1fr)_auto] items-center" : "flex flex-col", className)}>
      <span className="order-1 text-left text-sm font-semibold tabular-nums text-coop-secondary sm:order-none">
        {pageSize ? `Showing ${start}-${end} of ${totalItems} ${itemName}` : <>Page {currentPage} of {totalPages || 1} <span className="mx-2 text-[#9CA3AF]">·</span> {totalItems} {itemName}</>}
      </span>
      <div className={cn("order-3 col-span-2 flex flex-wrap items-center justify-center gap-2 sm:order-none sm:col-span-1", centerControls ? "sm:justify-center" : "sm:justify-end")}>
        <button
          type="button"
          aria-label="First page"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(1)}
          className="coop-icon-button grid size-11 place-items-center rounded-coop-control border border-coop-border bg-coop-surface text-coop-secondary transition hover:bg-coop-subtle disabled:opacity-50 sm:size-9"
        >
          <ChevronsLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Previous page"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="coop-icon-button grid size-11 place-items-center rounded-coop-control border border-coop-border bg-coop-surface text-coop-secondary transition hover:bg-coop-subtle disabled:opacity-50 sm:size-9"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="grid size-9 place-items-center rounded-md bg-coop-forest text-sm font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)]" aria-current="page">{currentPage}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={disabled || currentPage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="coop-icon-button grid size-11 place-items-center rounded-coop-control border border-coop-border bg-coop-surface text-coop-secondary transition hover:bg-coop-subtle disabled:opacity-50 sm:size-9"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Last page"
          disabled={disabled || currentPage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(totalPages)}
          className="coop-icon-button grid size-11 place-items-center rounded-coop-control border border-coop-border bg-coop-surface text-coop-secondary transition hover:bg-coop-subtle disabled:opacity-50 sm:size-9"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
      {onPageSizeChange && pageSize ? (
        <div className="order-2 col-start-2 w-36 self-center sm:order-none sm:col-start-auto sm:w-40 sm:self-auto">
          <StyledSelect
            value={`${pageSize} per page`}
            options={pageSizeOptions.map((option) => `${option} per page`)}
            onChange={(value) => onPageSizeChange(Number(value.split(" ")[0]))}
            aria-label="Rows per page"
            disabled={disabled}
            className="h-9"
          />
        </div>
      ) : null}
    </nav>
  );
}
