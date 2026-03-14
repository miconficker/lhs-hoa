/**
 * Calendar Day Cell Component
 *
 * Custom day cell for react-day-picker with dot indicators for available slots.
 * Each date cell shows:
 * - Day number
 * - 3 dot indicators (AM/PM/FULL_DAY) vertically stacked
 * - Green dots = available, transparent/hidden = unavailable
 */

import { cn } from "@/lib/utils";
import type { TimeBlockSlot } from "@/types";

interface CalendarDayCellProps {
  date: Date;
  availableSlots: TimeBlockSlot[];
  selected: boolean;
  onSelect: (date: Date) => void;
  disabled?: boolean;
  hidden?: boolean;
}

export function CalendarDayCell({
  date,
  availableSlots,
  selected,
  onSelect,
  disabled = false,
  hidden = false,
}: CalendarDayCellProps) {
  if (hidden) {
    return <div className="h-20" />;
  }

  const handleClick = () => {
    if (!disabled) {
      onSelect(date);
    }
  };

  const dots: TimeBlockSlot[] = ["AM", "PM", "FULL_DAY"];

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative h-20 w-full rounded-lg border transition-all",
        "hover:scale-[1.02] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : disabled
            ? "border-muted bg-muted/50 cursor-not-allowed opacity-50"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      {/* Day number */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-sm font-semibold">
        {date.getDate()}
      </div>

      {/* Dot indicators */}
      <div className="absolute top-7 left-1/2 -translate-x-1/2 flex flex-col gap-1">
        {dots.map((slot) => {
          const isAvailable = availableSlots.includes(slot);
          return (
            <div
              key={slot}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                isAvailable
                  ? selected
                    ? "bg-primary-foreground"
                    : "bg-green-500 dark:bg-green-400"
                  : "bg-transparent",
              )}
              aria-label={`${slot} slot ${isAvailable ? "available" : "unavailable"}`}
            />
          );
        })}
      </div>
    </button>
  );
}
