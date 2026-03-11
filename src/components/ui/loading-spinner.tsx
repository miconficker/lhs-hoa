import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const loadingSpinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const containerVariants = cva(
  "flex flex-col items-center justify-center gap-2 text-muted-foreground",
  {
    variants: {
      size: {
        sm: "gap-1.5",
        md: "gap-2",
        lg: "gap-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface LoadingSpinnerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingSpinnerVariants> {
  /**
   * Optional text to display below the spinner.
   */
  label?: string;
  /**
   * Whether to show the spinner inline with content (horizontal layout).
   */
  inline?: boolean;
}

function LoadingSpinner({
  className,
  size = "md",
  label,
  inline = false,
  ...props
}: LoadingSpinnerProps) {
  if (inline) {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
      >
        <Loader2
          className={cn(loadingSpinnerVariants({ size }))}
          aria-hidden="true"
        />
        {label && <span className="text-sm">{label}</span>}
      </span>
    );
  }

  return (
    <div
      className={cn(containerVariants({ size }), className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Loader2
        className={cn(loadingSpinnerVariants({ size }), "text-primary")}
        aria-hidden="true"
      />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export { LoadingSpinner, loadingSpinnerVariants };
