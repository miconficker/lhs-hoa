import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

const calloutVariants = cva(
  "relative w-full rounded-lg border p-4 flex gap-3 items-start",
  {
    variants: {
      variant: {
        info: "border-[hsl(var(--status-info-fg)/0.3)] bg-[hsl(var(--status-info-bg)/0.5)] text-[hsl(var(--status-info-fg))]",
        warning:
          "border-[hsl(var(--status-warning-fg)/0.3)] bg-[hsl(var(--status-warning-bg)/0.5)] text-[hsl(var(--status-warning-fg))]",
        error:
          "border-[hsl(var(--status-error-fg)/0.3)] bg-[hsl(var(--status-error-bg)/0.5)] text-[hsl(var(--status-error-fg))]",
        success:
          "border-[hsl(var(--status-success-fg)/0.3)] bg-[hsl(var(--status-success-bg)/0.5)] text-[hsl(var(--status-success-fg))]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const iconMap: Record<string, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

export interface CalloutProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  /**
   * The title of the callout. Displayed prominently above the content.
   */
  title?: string;
  /**
   * Optional action button to display at the end of the callout.
   */
  action?: React.ReactNode;
  /**
   * Whether to hide the icon. Default is false.
   */
  hideIcon?: boolean;
  /**
   * Custom icon to use instead of the default variant icon.
   */
  icon?: LucideIcon;
}

function Callout({
  className,
  variant = "info",
  title,
  action,
  hideIcon = false,
  icon: CustomIcon,
  children,
  ...props
}: CalloutProps) {
  const Icon = CustomIcon || iconMap[variant || "info"] || Info;

  const ariaRole =
    variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <div
      className={cn(calloutVariants({ variant }), className)}
      role={ariaRole}
      aria-live={variant === "error" ? "assertive" : "polite"}
      {...props}
    >
      {!hideIcon && (
        <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <div className="flex-1 space-y-2">
        {title && <p className="font-medium text-sm leading-tight">{title}</p>}
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Callout, calloutVariants };
