/**
 * Booking History Component
 *
 * Displays booking history for both residents and guests.
 * Shows upcoming, past, and cancelled bookings.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CreditCard, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import type { BookingWithReference, UnifiedBookingStatus } from "@/types";

interface BookingHistoryProps {
  userId?: string; // For residents
  customerId?: string; // For guests
}

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<string, string> = {
  AM: "Morning",
  PM: "Afternoon",
  FULL_DAY: "Full Day",
};

export function BookingHistory({ userId, customerId }: BookingHistoryProps) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingWithReference[]>([]);
  const [filter, setFilter] = useState<
    "all" | "upcoming" | "past" | "cancelled"
  >("upcoming");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [userId, customerId, filter]);

  async function loadBookings() {
    try {
      setLoading(true);
      const result = await api.bookings.getMyBookings({
        filter: filter === "all" ? undefined : filter,
        ...(userId && { user_id: userId }),
        ...(customerId && { customer_id: customerId }),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBookings(result.data?.bookings || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      const result = await api.bookings.cancel(bookingId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking cancelled successfully");
      loadBookings(); // Reload to update the list
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    }
  };

  const handleUploadProof = (bookingId: string) => {
    // Navigate to payment proof upload page
    navigate(`/bookings/${bookingId}/payment`);
  };

  const getStatusBadge = (status: UnifiedBookingStatus) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    const colors = getStatusColorClasses(status);

    return (
      <Badge
        variant={config.variant}
        className={cn("gap-1", colors.border, colors.bg, colors.text)}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const renderBookingCard = (booking: BookingWithReference) => {
    const allowsPayment = [
      "payment_due",
    ].includes(booking.booking_status);
    const allowsCancellation = !["rejected", "cancelled", "no_show"].includes(
      booking.booking_status,
    );

    return (
      <div
        key={booking.id}
        className={cn(
          "p-4 border rounded-lg transition-all",
          booking.booking_status === "confirmed" &&
            "border-green-200 bg-green-50 dark:bg-green-950/20",
          booking.booking_status === "rejected" &&
            "border-red-200 bg-red-50 dark:bg-red-950/20",
          booking.booking_status === "cancelled" &&
            "border-gray-200 bg-gray-50 dark:bg-gray-900",
        )}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Status & Reference */}
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(booking.booking_status)}
              <span className="text-xs text-muted-foreground">
                {booking.reference_number}
              </span>
            </div>

            {/* Date & Time */}
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Amenity:</span>{" "}
                <span className="font-medium">
                  {amenityLabels[booking.amenity_type]}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium">
                  {format(new Date(booking.date), "EEEE, MMMM d, yyyy")}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Time:</span>{" "}
                <span className="font-medium">{slotLabels[booking.slot]}</span>
              </p>
            </div>

            {/* Purpose & Attendees */}
            {(booking.purpose || booking.attendee_count) && (
              <div className="space-y-1 text-sm">
                {booking.purpose && (
                  <p>
                    <span className="text-muted-foreground">Purpose:</span>{" "}
                    {booking.purpose}
                  </p>
                )}
                {booking.attendee_count && (
                  <p>
                    <span className="text-muted-foreground">Attendees:</span>{" "}
                    {booking.attendee_count}
                  </p>
                )}
              </div>
            )}

            {/* Payment Status */}
            {booking.amount > 0 && (
              <div className="pt-3 border-t space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    ₱{booking.amount.toLocaleString()}
                  </span>
                </div>
                {booking.amount_paid > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span className="text-muted-foreground">Paid:</span>
                    <span>₱{booking.amount_paid.toLocaleString()}</span>
                  </div>
                )}
                {booking.amount - booking.amount_paid > 0 && (
                  <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                    <span className="text-muted-foreground">Balance:</span>
                    <span>
                      ₱{(booking.amount - booking.amount_paid).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Admin Notes */}
            {booking.admin_notes && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-sm">
                <strong className="text-xs">Note:</strong> {booking.admin_notes}
              </div>
            )}

            {/* Rejection Reason */}
            {booking.rejection_reason && (
              <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-600">
                <strong className="text-xs">Reason:</strong>{" "}
                {booking.rejection_reason}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex md:flex-col gap-2">
            {allowsPayment && (
              <Button
                size="sm"
                onClick={() => handleUploadProof(booking.id)}
                className="w-full md:w-auto"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Upload Payment
              </Button>
            )}

            {booking.booking_status === "confirmed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/bookings/${booking.id}/details`)}
                className="w-full md:w-auto"
              >
                View Details
              </Button>
            )}

            {allowsCancellation && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCancel(booking.id)}
                className="w-full md:w-auto text-destructive hover:text-destructive"
              >
                Cancel Booking
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading bookings...
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="mx-auto w-12 h-12 mb-3 opacity-50" />
                <p>No bookings found</p>
                <p className="text-sm mt-2">
                  {filter === "all"
                    ? "You haven't made any bookings yet."
                    : `You have no ${filter} bookings.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">{bookings.map(renderBookingCard)}</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
