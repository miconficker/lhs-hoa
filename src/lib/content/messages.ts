// User-facing messages using UK plain language standards
export const messages = {
  // Auth
  loginSuccess: "Welcome back!",
  loginError: "We couldn't sign you in. Check your email and password.",
  logoutSuccess: "You've been signed out.",

  // Service requests
  requestSubmitted: "We've received your request. We'll look at it soon.",
  requestUpdated: "Request updated.",
  requestDeleted: "Request deleted.",

  // Payments
  paymentSubmitted:
    "Thanks! We've received your payment proof. We'll check it and let you know.",
  paymentApproved: "Payment confirmed!",
  paymentRejected:
    "We couldn't accept this payment. Please check the details and try again.",

  // Reservations
  reservationCreated: "Your space is booked!",
  reservationCancelled: "Booking cancelled.",

  // Errors
  somethingWentWrong: "Something went wrong. Please try again.",
  networkError: "Can't connect. Check your internet and try again.",
  notFound: "We couldn't find that.",
  unauthorized: "You need to sign in first.",

  // Success
  saved: "Saved!",
  deleted: "Deleted.",
  updated: "Updated.",

  // Loading
  loading: "Loading...",
  saving: "Saving...",
  sending: "Sending...",

  // Empty states
  noResults: "Nothing here yet.",
  noRequests: "No problems reported yet.",
  noPayments: "No payments yet.",
  noAnnouncements: "No news yet.",
} as const;

export type MessageKey = keyof typeof messages;
