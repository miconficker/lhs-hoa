// src/components/delinquency/RestorationCountdown.tsx
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface RestorationCountdownProps {
  voting_restored_at: string | null;
  days_until_restore?: number;
}

export function RestorationCountdown({
  voting_restored_at,
  days_until_restore: initialDays,
}: RestorationCountdownProps) {
  const [daysLeft, setDaysLeft] = useState(initialDays);

  useEffect(() => {
    if (voting_restored_at) {
      const updateDays = () => {
        const restoredDate = new Date(voting_restored_at);
        const now = new Date();
        const diff = Math.ceil(
          (restoredDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        setDaysLeft(Math.max(0, diff));
      };

      updateDays();
      const interval = setInterval(updateDays, 60 * 60 * 1000); // Update hourly
      return () => clearInterval(interval);
    }
  }, [voting_restored_at]);

  if (!voting_restored_at || daysLeft === undefined) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>
        Voting rights restore in{" "}
        <span className="font-medium text-foreground">
          {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </span>
      </span>
    </div>
  );
}
