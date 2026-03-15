import type { Booking, BookingWithCustomer } from '../../types';
import type { NotificationType } from '../../types';

/**
 * Amenity labels for notification content
 */
const AMENITY_LABELS: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court"
};

/**
 * Slot labels for notification content
 */
const SLOT_LABELS: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)"
};

/**
 * Create a notification for a booking lifecycle event
 *
 * @param db - D1 database instance
 * @param booking - Booking object (must have user_id or customer_id)
 * @param action - Type of booking event
 * @param reason - Optional reason (for rejections)
 * @returns Promise that resolves when notification is created
 */
export async function createBookingNotification(
  db: D1Database,
  booking: Booking | BookingWithCustomer,
  action: string,
  reason?: string
): Promise<void> {
  // Get the user ID (residents use user_id, guests use customer_id)
  const userId = booking.user_id || booking.customer_id;
  if (!userId) return;

  let title = "";
  let content = "";
  let type: NotificationType = "booking_status";
  let link = `/bookings/${booking.id}/details`;

  const amenity = AMENITY_LABELS[booking.amenity_type] || booking.amenity_type;
  const date = new Date(booking.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const slot = SLOT_LABELS[booking.slot] || booking.slot;

  // Generate notification content based on action
  switch (action) {
    case "approved_to_payment_due":
      if ((booking.amount || 0) > 0) {
        title = "Payment Required for Booking";
        content = `Your ${amenity} booking for ${date} (${slot}) has been approved. Please submit payment proof within 48 hours to secure your booking.`;
        link = `/bookings/${booking.id}/payment`;
      } else {
        title = "Booking Confirmed";
        content = `Your ${amenity} booking for ${date} (${slot}) is confirmed! We look forward to seeing you.`;
      }
      break;

    case "payment_verified_confirmed":
      title = "Payment Verified - Booking Confirmed";
      content = `Your payment has been received and verified. Your ${amenity} booking for ${date} (${slot}) is now confirmed.`;
      break;

    case "rejected":
      title = "Booking Rejected";
      content = `Your ${amenity} booking request for ${date} (${slot}) has been rejected.`;
      if (reason) {
        content += ` Reason: ${reason}`;
      }
      break;

    case "cancelled":
      title = "Booking Cancelled";
      content = `Your ${amenity} booking for ${date} (${slot}) has been cancelled.`;
      break;

    case "payment_review_failed":
      title = "Payment Proof Unclear";
      content = `The payment proof submitted for your ${amenity} booking is unclear. Please resubmit a clear photo/screenshot of your payment receipt.`;
      link = `/bookings/${booking.id}/payment`;
      break;

    case "cancelled_payment_reminder":
      title = "Payment Overdue";
      content = `Payment for your ${amenity} booking on ${date} is now overdue. Please pay or contact us to avoid cancellation.`;
      link = `/bookings/${booking.id}/payment`;
      break;

    case "booking_created_admin":
      title = "Booking Created";
      content = `A ${amenity} booking for ${date} (${slot}) has been created on your behalf.`;
      break;

    default:
      // Generic booking update
      title = "Booking Update";
      content = `Your ${amenity} booking for ${date} (${slot}) has been updated.`;
  }

  // Import and call the notification helper
  const { createNotification } = await import('../routes/notifications');
  // For residents: pass userId, for external guests: pass customer_id
  await createNotification(
    db,
    booking.user_id || null,
    type,
    title,
    content,
    link,
    booking.customer_id || null
  );
}
