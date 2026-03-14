import { CheckCircle2, Circle, XCircle, MinusCircle } from "lucide-react";

export type BookingStatus =
  | "submitted"
  | "payment_due"
  | "payment_review"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "no_show";

interface Phase {
  key: string;
  label: string;
  statuses: BookingStatus[];
}

const phases: Phase[] = [
  { key: "submitted", label: "Submitted", statuses: ["submitted"] },
  { key: "payment", label: "Payment", statuses: ["payment_due"] },
  { key: "verified", label: "Verified", statuses: ["payment_review"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
];

interface StatusPhaseIndicatorProps {
  status: BookingStatus;
  className?: string;
}

export function StatusPhaseIndicator({
  status,
  className = "",
}: StatusPhaseIndicatorProps) {
  // Determine current phase index
  const currentPhaseIndex = phases.findIndex((phase) =>
    phase.statuses.includes(status),
  );

  // Handle special states
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled";
  const isNoShow = status === "no_show";

  if (isRejected) {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <XCircle className="w-8 h-8 text-red-500" />
        <span className="text-lg font-semibold text-red-600 dark:text-red-400">
          Rejected
        </span>
      </div>
    );
  }

  if (isCancelled || isNoShow) {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <MinusCircle className="w-8 h-8 text-gray-400" />
        <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">
          {isNoShow ? "No Show" : "Cancelled"}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {phases.map((phase, index) => {
        const isCurrent = index === currentPhaseIndex;
        const isCompleted = index < currentPhaseIndex;

        return (
          <div key={phase.key} className="flex items-center">
            {/* Phase Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  border-2 transition-all
                  ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg"
                      : isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle
                    className={`w-5 h-5 ${isCurrent ? "animate-pulse" : ""}`}
                  />
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isCurrent
                    ? "text-primary font-bold"
                    : isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-400"
                }`}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < phases.length - 1 && (
              <div
                className={`
                  w-12 sm:w-20 h-0.5 mx-1 sm:mx-2 transition-colors
                  ${
                    index < currentPhaseIndex
                      ? "bg-green-500"
                      : "bg-gray-300 dark:bg-gray-600 border-t border-dashed"
                  }
                `}
                style={{ marginTop: "-1.5rem" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function getStatusPhaseInfo(status: BookingStatus): {
  phase: number;
  phaseName: string;
  description: string;
  nextStep: string;
  isRejected: boolean;
  isCancelled: boolean;
} {
  const phaseMap: Record<
    BookingStatus,
    { phase: number; phaseName: string; description: string; nextStep: string }
  > = {
    submitted: {
      phase: 1,
      phaseName: "Submitted",
      description:
        "Your request has been submitted successfully. Our team will review it shortly.",
      nextStep:
        "Wait for approval. You'll receive an update within 24-48 hours.",
    },
    payment_due: {
      phase: 2,
      phaseName: "Payment Required",
      description:
        "Your request has been approved! Please complete your payment to confirm your booking.",
      nextStep:
        "Upload proof of payment via the link provided, or contact admin for assistance.",
    },
    payment_review: {
      phase: 3,
      phaseName: "Verifying Payment",
      description:
        "Payment received! Our team is verifying your payment proof.",
      nextStep:
        "We'll confirm your booking within 24-48 hours after verification.",
    },
    confirmed: {
      phase: 4,
      phaseName: "Confirmed",
      description:
        "Your booking has been confirmed! We look forward to hosting you.",
      nextStep:
        "Arrive 15 minutes before your scheduled time. Present your booking confirmation upon arrival.",
    },
    rejected: {
      phase: 0,
      phaseName: "Rejected",
      description:
        "Your inquiry has been declined. This may be due to availability or other reasons.",
      nextStep:
        "You can submit a new inquiry with different dates or contact us for more information.",
    },
    cancelled: {
      phase: 0,
      phaseName: "Cancelled",
      description: "This booking has been cancelled.",
      nextStep: "You can submit a new inquiry if you'd like to book again.",
    },
    no_show: {
      phase: 0,
      phaseName: "No Show",
      description: "This booking was marked as a no-show.",
      nextStep: "Contact admin if you believe this is incorrect.",
    },
  };

  const info = phaseMap[status] || phaseMap.submitted;

  return {
    ...info,
    isRejected: status === "rejected",
    isCancelled: status === "cancelled",
  };
}
