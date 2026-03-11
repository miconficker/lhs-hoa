import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

const iconContainerVariants = cva(
  "flex items-center justify-center rounded-lg shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary/10 text-primary",
        success:
          "bg-[hsl(var(--status-success-bg)/0.5)] text-[hsl(var(--status-success-fg))]",
        warning:
          "bg-[hsl(var(--status-warning-bg)/0.5)] text-[hsl(var(--status-warning-fg))]",
        error:
          "bg-[hsl(var(--status-error-bg)/0.5)] text-[hsl(var(--status-error-fg))]",
        info: "bg-[hsl(var(--status-info-bg)/0.5)] text-[hsl(var(--status-info-fg))]",
        neutral:
          "bg-[hsl(var(--status-neutral-bg)/0.5)] text-[hsl(var(--status-neutral-fg))]",
        muted: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "p-1.5",
        md: "p-2",
        lg: "p-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface IconContainerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconContainerVariants> {
  /**
   * The Lucide icon component to render.
   */
  icon: LucideIcon;
  /**
   * Optional label for accessibility (aria-label).
   */
  label?: string;
}

function IconContainer({
  className,
  variant,
  size,
  icon: Icon,
  label,
  ...props
}: IconContainerProps) {
  return (
    <div
      className={cn(iconContainerVariants({ variant, size }), className)}
      aria-label={label}
      aria-hidden={!label}
      {...props}
    >
      <Icon
        className={cn(
          size === "sm" && "h-3.5 w-3.5",
          size === "md" && "h-5 w-5",
          size === "lg" && "h-6 w-6",
        )}
        aria-hidden="true"
      />
    </div>
  );
}

export { IconContainer, iconContainerVariants };
