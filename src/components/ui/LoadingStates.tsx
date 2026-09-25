import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RetryButton } from "./RetryButton";

export function LoadingSpinner({ label = "Loading...", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status" aria-live="polite">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function LoadingButton({
  loading,
  loadingLabel = "Processing...",
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button {...props} disabled={loading || props.disabled} aria-busy={loading || undefined} className={cn(className, loading && "cursor-wait")}>
      {loading ? <LoadingSpinner label={loadingLabel} /> : children}
    </button>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-28 animate-pulse rounded-lg bg-[#E7F2E4]", className)} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading table" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-[#EEF2EC]" />)}
    </div>
  );
}

export function LoadingOverlay({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-white/80 backdrop-blur-[1px]" role="status" aria-live="polite">
      <LoadingSpinner label={label} className="font-semibold text-[#123D2A]" />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#B9CABD] bg-white/70 p-8 text-center">
      <div>
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[#E7F2E4] text-[#1F6B43]"><AlertCircle className="size-5" aria-hidden="true" /></div>
        <h2 className="mt-3 text-lg font-black text-[#123D2A]">{title}</h2>
        <p className="mt-1 text-sm text-[#5D6D63]">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void | Promise<void> }) {
  return (
    <div role="alert" aria-live="assertive" className="rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-5 text-center text-sm text-[#7A3023]">
      <p>{message}</p>
      {onRetry ? <RetryButton onRetry={onRetry} /> : null}
    </div>
  );
}
