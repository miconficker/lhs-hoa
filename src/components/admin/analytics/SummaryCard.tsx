import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  format?: "currency" | "number" | "percent";
}

export function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  format = "number",
}: SummaryCardProps) {
  const formatValue = (val: string | number) => {
    switch (format) {
      case "currency":
        return `₱${Number(val).toLocaleString()}`;
      case "percent":
        return `${Number(val).toFixed(1)}%`;
      default:
        return String(val);
    }
  };

  const getTrendIcon = () => {
    if (trend === "up") return <ArrowUp className="w-4 h-4" />;
    if (trend === "down") return <ArrowDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600 dark:text-green-400";
    if (trend === "down") return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{formatValue(value)}</p>
          {change !== undefined && (
            <p
              className={cn("text-xs flex items-center gap-1", getTrendColor())}
            >
              {getTrendIcon()}
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
