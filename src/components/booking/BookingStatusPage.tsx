/**
 * Booking Status Page Component
 *
 * Public page for checking booking status.
 * Shows real-time booking status with auto-polling.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CreditCard, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import type { BookingWithReference, UnifiedBookingStatus } from "@/types";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function BookingStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingWithReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (id) {
      loadBookingStatus(id);

      // Set up polling for non-terminal statuses
      const interval = setInterval(() => {
        loadBookingStatus(id);
      }, 30000); // Poll every 30 seconds

      return () => clearInterval(interval);
    }
  }, [id]);

  async function loadBookingStatus(bookingId: string) {
    try {
      const result = await api.bookings.getStatus(bookingId);

      if (result.error) {
        if (result.error.includes("not found")) {
          setNotFound(true);
        }
        return;
      }

      const booking = result.data?.booking;
      if (!booking) {
        setNotFound(true);
        return;
      }

      setBooking(booking);
      setNotFound(false);

      // Stop polling if terminal status reached
      const terminalStatuses: UnifiedBookingStatus[] = [
        "confirmed",
        "rejected",
        "cancelled",
        "no_show",
      ];
      if (terminalStatuses.includes(booking.booking_status)) {
        setPolling(false);
      } else {
        setPolling(true);
      }
    } catch (error) {
      console.error("Error loading booking status:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusDisplay = (status: UnifiedBookingStatus) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    const colors = getStatusColorClasses(status);

    return (
      <Card className={cn("border-2", colors.border, colors.bg)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-full", colors.bg)}>
              <Icon className={cn("w-8 h-8", colors.text)} />
            </div>
            <div>
              <h3 className={cn("text-xl font-semibold", colors.text)}>
                {config.label}
              </h3>
              <p className="text-sm mt-1 text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-12 pb-12 text-center">
            <XCircle className="mx-auto w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The booking ID may be incorrect or the booking has been removed.
            </p>
            <Button onClick={() => navigate("/external-rentals")}>
              Make a New Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allowsPayment = [
    "payment_due",
  ].includes(booking.booking_status);
  const canViewDetails = booking.booking_status === "confirmed";

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Booking Status</h1>
          <p className="text-muted-foreground">
            Reference: {booking.reference_number}
          </p>
          {polling && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Auto-refreshing every 30 seconds
            </div>
          )}
        </div>

        {/* Status Banner */}
        {getStatusDisplay(booking.booking_status)}

        {/* Booking Details */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Booking Details</h3>
            <div className="space-y-3">
              <DetailRow
                label="Amenity"
                value={amenityLabels[booking.amenity_type]}
              />
              <DetailRow
                label="Date"
                value={format(new Date(booking.date), "EEEE, MMMM d, yyyy")}
              />
              <DetailRow label="Time" value={slotLabels[booking.slot]} />
              <DetailRow
                label="Amount"
                value={`₱${booking.amount?.toLocaleString() || "0"}`}
              />

              {/* Payment Status */}
              {(booking.amount || 0) > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <DetailRow
                    label="Payment Status"
                    value={
                      <Badge
                        variant={
                          booking.payment_status === "paid"
                            ? "default"
                            : booking.payment_status === "partial"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {booking.payment_status?.toUpperCase()}
                      </Badge>
                    }
                  />
                  {booking.amount_paid > 0 && (
                    <DetailRow
                      label="Amount Paid"
                      value={`₱${booking.amount_paid.toLocaleString()}`}
                    />
                  )}
                  {booking.amount - booking.amount_paid > 0 && (
                    <DetailRow
                      label="Balance Due"
                      value={`₱${(booking.amount - booking.amount_paid).toLocaleString()}`}
                      valueClass="text-orange-600 dark:text-orange-400"
                    />
                  )}
                </div>
              )}

              {/* Admin Notes */}
              {booking.admin_notes && (
                <div className="pt-4 border-t">
                  <DetailRow label="Notes" value={booking.admin_notes} />
                </div>
              )}

              {/* Rejection Reason */}
              {booking.rejection_reason && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">
                    Rejection Reason:
                  </p>
                  <p className="text-sm text-red-600">
                    {booking.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {allowsPayment && (
            <Button
              size="lg"
              onClick={() => navigate(`/bookings/${booking.id}/payment`)}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Upload Payment Proof
            </Button>
          )}
          {canViewDetails && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(`/bookings/${booking.id}/details`)}
            >
              View Full Details
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            onClick={() => navigate("/external-rentals")}
          >
            Make Another Booking
          </Button>
        </div>

        {/* Help Section */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">Need Help?</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Payment Instructions:</strong> Please upload your
                payment proof (screenshot or photo of receipt) within 48 hours.
              </p>
              <p>
                <strong>Contact Us:</strong> If you have questions, please
                contact the HOA admin.
              </p>
              <p className="text-xs">
                <strong>Note:</strong> This page auto-refreshes every 30 seconds
                while your booking is being processed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}

function DetailRow({ label, value, valueClass }: DetailRowProps) {
  return (
    <div className="flex justify-between items-start py-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className={cn("text-sm font-medium text-right", valueClass)}>
        {value}
      </span>
    </div>
  );
}
