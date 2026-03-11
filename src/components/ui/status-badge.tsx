import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        success:
          "border-transparent bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] hover:bg-[hsl(var(--status-success-bg))]/80",
        warning:
          "border-transparent bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))] hover:bg-[hsl(var(--status-warning-bg))]/80",
        error:
          "border-transparent bg-[hsl(var(--status-error-bg))] text-[hsl(var(--status-error-fg))] hover:bg-[hsl(var(--status-error-bg))]/80",
        info: "border-transparent bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))] hover:bg-[hsl(var(--status-info-bg))]/80",
        neutral:
          "border-transparent bg-[hsl(var(--status-neutral-bg))] text-[hsl(var(--status-neutral-fg))] hover:bg-[hsl(var(--status-neutral-bg))]/80",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /**
   * Screen reader text for the status. If not provided, will use the variant name.
   */
  srLabel?: string;
}

function StatusBadge({
  className,
  variant,
  srLabel,
  children,
  ...props
}: StatusBadgeProps) {
  // Default srLabel to variant name if not provided
  const ariaLabel = srLabel || variant || "status";

  return (
    <span
      className={cn(statusBadgeVariants({ variant }), className)}
      role="status"
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
