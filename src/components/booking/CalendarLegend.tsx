/**
 * Calendar Legend Component
 *
 * Shows the legend for dot indicators on calendar cells.
 * Explains what each dot position represents.
 */

import { cn } from "@/lib/utils";
import type { TimeBlockSlot } from "@/types";

interface CalendarLegendProps {
  className?: string;
}

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

const slotDescriptions: Record<TimeBlockSlot, string> = {
  AM: "Top dot",
  PM: "Middle dot",
  FULL_DAY: "Bottom dot",
};

export function CalendarLegend({ className }: CalendarLegendProps) {
  const slots: TimeBlockSlot[] = ["AM", "PM", "FULL_DAY"];

  return (
    <div className={cn("flex items-center gap-6 text-sm", className)}>
      <div className="font-medium text-muted-foreground">Legend:</div>
      {slots.map((slot) => (
        <div key={slot} className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                "bg-green-500 dark:bg-green-400",
              )}
              aria-label={`${slot} available indicator`}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{slotLabels[slot]}</span>
            <span className="text-xs text-muted-foreground">
              {slotDescriptions[slot]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
