import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./LoadingStates";

const buttonVariants = cva(
  "coop-button inline-flex h-11 items-center justify-center gap-2 rounded-coop-control px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-coop-forest text-white shadow-coop-soft hover:bg-coop-primary-hover focus-visible:outline-coop-forest",
        secondary:
          "border border-coop-border bg-coop-surface text-coop-forest hover:bg-coop-subtle focus-visible:outline-coop-green",
        ghost: "text-coop-forest hover:bg-coop-subtle focus-visible:outline-coop-green",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean; loadingLabel?: string };

export function Button({ className, variant, size, loading = false, loadingLabel = "Processing...", children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoadingSpinner label={loadingLabel} /> : children}
    </button>
  );
}
