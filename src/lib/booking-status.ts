/**
 * Unified Booking Status Configuration
 *
 * This file centralizes all booking status labels, colors, and icons.
 * All components should import from this file to ensure consistency.
 *
 * Status workflow:
 * - External guests: inquiry_submitted → pending_approval → pending_payment → pending_verification → confirmed
 * - Residents: pending_resident → confirmed (or directly to confirmed)
 * - Shared terminal states: confirmed, rejected, cancelled, no_show
 */

import {
  MessageSquare,
  Clock,
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Ban,
  UserX,
} from "lucide-react";

export const BOOKING_STATUS_CONFIG = {
  // External guest path (existing, unchanged)
  inquiry_submitted: {
    label: "Inquiry Submitted",
    description: "Your inquiry has been received and is being reviewed.",
    color: "blue",
    icon: MessageSquare,
    variant: "default" as const,
  },
  pending_approval: {
    label: "Pending Approval",
    description: "Your booking is being reviewed by admin.",
    color: "yellow",
    icon: Clock,
    variant: "secondary" as const,
  },
  pending_payment: {
    label: "Awaiting Payment",
    description: "Your booking has been approved! Please complete payment.",
    color: "orange",
    icon: CreditCard,
    variant: "outline" as const,
  },
  pending_verification: {
    label: "Verifying Payment",
    description: "Thank you! We are verifying your payment.",
    color: "purple",
    icon: Search,
    variant: "default" as const,
  },

  // Resident-only path (new, simpler)
  pending_resident: {
    label: "Pending",
    description: "Your booking is being processed.",
    color: "yellow",
    icon: Clock,
    variant: "secondary" as const,
  },
  awaiting_resident_payment: {
    label: "Awaiting Payment",
    description: "Please complete payment to confirm your booking.",
    color: "orange",
    icon: CreditCard,
    variant: "outline" as const,
  },

  // Shared terminal states
  confirmed: {
    label: "Confirmed",
    description: "Your booking is confirmed!",
    color: "green",
    icon: CheckCircle,
    variant: "default" as const,
    success: true,
  },
  rejected: {
    label: "Rejected",
    description: "Your booking could not be approved.",
    color: "red",
    icon: XCircle,
    variant: "destructive" as const,
  },
  cancelled: {
    label: "Cancelled",
    description: "This booking has been cancelled.",
    color: "gray",
    icon: Ban,
    variant: "outline" as const,
  },
  no_show: {
    label: "No Show",
    description: "This booking was marked as a no-show.",
    color: "red",
    icon: UserX,
    variant: "destructive" as const,
  },
} as const;

export type BookingStatus = keyof typeof BOOKING_STATUS_CONFIG;

/**
 * Valid status transitions by customer type
 */
export const VALID_TRANSITIONS: Record<
  "resident" | "external",
  Record<string, BookingStatus[]>
> = {
  resident: {
    pending_resident: ["confirmed", "cancelled"],
    pending_payment: ["confirmed", "cancelled"],
    confirmed: ["cancelled", "no_show"],
    cancelled: [],
    no_show: ["cancelled"],
  },
  external: {
    inquiry_submitted: ["pending_approval", "rejected", "cancelled"],
    pending_approval: ["pending_payment", "rejected", "cancelled"],
    pending_payment: ["pending_verification", "cancelled"],
    pending_verification: ["confirmed", "pending_payment", "cancelled"],
    confirmed: ["cancelled", "no_show"],
    rejected: [],
    cancelled: [],
    no_show: ["cancelled"],
  },
};

/**
 * Get status configuration for a booking status
 */
export function getStatusConfig(status: BookingStatus) {
  return (
    BOOKING_STATUS_CONFIG[status] || BOOKING_STATUS_CONFIG.inquiry_submitted
  );
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
  customerType: "resident" | "external",
): boolean {
  const transitions = VALID_TRANSITIONS[customerType];
  const allowed = transitions[fromStatus as keyof typeof transitions] || [];
  return allowed.includes(toStatus);
}

/**
 * Get available next statuses for a booking
 */
export function getNextStatuses(
  currentStatus: BookingStatus,
  customerType: "resident" | "external",
): BookingStatus[] {
  const transitions = VALID_TRANSITIONS[customerType];
  return transitions[currentStatus as keyof typeof transitions] || [];
}

/**
 * Check if a status is a terminal state (no further transitions)
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return ["confirmed", "rejected", "cancelled", "no_show"].includes(status);
}

/**
 * Check if a status allows payment
 */
export function allowsPayment(status: BookingStatus): boolean {
  return [
    "pending_payment",
    "awaiting_resident_payment",
    "pending_verification",
  ].includes(status);
}

/**
 * Check if a status allows cancellation
 */
export function allowsCancellation(status: BookingStatus): boolean {
  return !["rejected", "cancelled", "no_show"].includes(status);
}

/**
 * Get color classes for status badges
 */
export function getStatusColorClasses(status: BookingStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const config = getStatusConfig(status);

  const colorMap = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
    },
    yellow: {
      bg: "bg-yellow-50 dark:bg-yellow-950/20",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-200 dark:border-yellow-800",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-950/20",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/20",
      text: "text-purple-700 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-950/20",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950/20",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
    },
    gray: {
      bg: "bg-gray-50 dark:bg-gray-900",
      text: "text-gray-700 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-800",
    },
  };

  return colorMap[config.color as keyof typeof colorMap] || colorMap.gray;
}
