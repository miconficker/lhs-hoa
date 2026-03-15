import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CreditCard,
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Home,
  Receipt,
} from "lucide-react";

import { api } from "@/lib/api";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPhaseIndicator } from "@/components/public/StatusPhaseIndicator";

import type { BookingWithCustomer } from "@/types";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const amenityIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  clubhouse: Home,
  pool: ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 12h20M2 12l5-5m0 10l5-5M22 12l-5-5m0 10l-5-5" />
    </svg>
  ),
  "basketball-court": ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5.6 5.6h12.8M5.6 18.4h12.8" />
    </svg>
  ),
  "tennis-court": ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M2 12h20" />
    </svg>
  ),
};

const slotLabels: Record<string, { label: string; time: string }> = {
  AM: { label: "Morning", time: "8:00 AM - 12:00 PM" },
  PM: { label: "Afternoon", time: "1:00 PM - 5:00 PM" },
  FULL_DAY: { label: "Full Day", time: "8:00 AM - 5:00 PM" },
};

const paymentStatusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  unpaid: { label: "Unpaid", variant: "outline", color: "text-gray-600" },
  partial: {
    label: "Partial Payment",
    variant: "secondary",
    color: "text-amber-600",
  },
  paid: { label: "Fully Paid", variant: "default", color: "text-green-600" },
  overdue: { label: "Overdue", variant: "destructive", color: "text-red-600" },
  waived: { label: "Waived", variant: "outline", color: "text-blue-600" },
};

export function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingWithCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    try {
      setLoading(true);
      const result = await api.bookings.get(id!);
      if (result.error) {
        toast.error(result.error);
        navigate("/reservations");
        return;
      }
      setBooking(result.data?.booking || null);
    } catch (e) {
      console.error("Error loading booking details:", e);
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary" />
      </div>
    );
  }

  if (!booking) return null;

  const statusConfig = getStatusConfig(booking.booking_status);
  const statusColors = getStatusColorClasses(booking.booking_status);
  const allowsPayment = booking.booking_status === "payment_due";
  const AmenityIcon = amenityIcons[booking.amenity_type] || Home;

  const formattedDate = new Date(booking.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const remainingBalance = (booking.amount || 0) - (booking.amount_paid || 0);
  const paymentStatusInfo =
    paymentStatusConfig[booking.payment_status || "unpaid"] ||
    paymentStatusConfig.unpaid;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Timeline Phase Indicator */}
      <Card>
        <CardContent className="pt-6">
          <StatusPhaseIndicator status={booking.booking_status as any} />
        </CardContent>
      </Card>

      {/* Header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 -ml-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Booking Details</h1>
            <p className="text-muted-foreground">
              Reference:{" "}
              <span className="font-mono">
                {booking.reference_number || booking.id.slice(0, 8)}
              </span>
            </p>
          </div>
          <Badge
            variant={statusConfig.variant}
            className={cn(
              "gap-1.5 px-3 py-1.5 text-sm",
              statusColors.border,
              statusColors.bg,
              statusColors.text,
            )}
          >
            <statusConfig.icon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Booking Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <AmenityIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <CardTitle className="text-xl">
                {amenityLabels[booking.amenity_type]}
              </CardTitle>
              <CardDescription className="text-base">
                {booking.customer_type === "resident"
                  ? "Resident Booking"
                  : "External Guest Booking"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{formattedDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Time Slot</p>
                <p className="font-medium">{slotLabels[booking.slot].label}</p>
                <p className="text-xs text-muted-foreground">
                  {slotLabels[booking.slot].time}
                </p>
              </div>
            </div>
          </div>

          {booking.purpose && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Purpose / Event Details
                </p>
                <p className="font-medium">{booking.purpose}</p>
                {booking.event_type && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {booking.event_type}
                  </Badge>
                )}
                {booking.attendee_count && (
                  <span className="text-xs text-muted-foreground ml-2">
                    • {booking.attendee_count} attendees
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">
                {booking.first_name} {booking.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{booking.email}</p>
            </div>
            {booking.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{booking.phone}</p>
              </div>
            )}
            {booking.household_address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{booking.household_address}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Information Card */}
      <Card
        className={
          booking.payment_status === "paid"
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment Information
          </CardTitle>
          <CardDescription>
            {booking.payment_status === "paid"
              ? "Payment completed"
              : booking.payment_status === "partial"
                ? "Partial payment received"
                : "Payment pending"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="text-lg font-bold">
                ₱{(booking.amount || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Amount Paid</span>
              <span
                className={cn(
                  "font-semibold",
                  booking.amount_paid && booking.amount_paid > 0
                    ? "text-green-600 dark:text-green-400"
                    : "",
                )}
              >
                ₱{(booking.amount_paid || 0).toLocaleString()}
              </span>
            </div>
            {remainingBalance > 0 && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Remaining Balance</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  ₱{remainingBalance.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Payment Status</span>
              <Badge
                variant={paymentStatusInfo.variant}
                className={paymentStatusInfo.color}
              >
                {paymentStatusInfo.label}
              </Badge>
            </div>
          </div>

          {booking.payment_method && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium">{booking.payment_method}</p>
            </div>
          )}

          {booking.receipt_number && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Receipt Number</p>
              <p className="font-mono text-sm">{booking.receipt_number}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof of Payment Card */}
      {booking.proof_of_payment_url && (
        <Card
          className={
            booking.booking_status === "payment_review"
              ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
              : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {booking.booking_status === "payment_review" ? (
                <Clock className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              Proof of Payment
            </CardTitle>
            <CardDescription>
              {booking.booking_status === "payment_review"
                ? "Your proof of payment is being reviewed by admin"
                : "Proof of payment verified"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/bookings/${booking.id}/proof`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Receipt className="w-4 h-4 mr-2" />
                View Proof
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      {(booking.admin_notes || booking.rejection_reason) && (
        <Card
          className={
            booking.rejection_reason
              ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
              : ""
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {booking.rejection_reason ? (
                <XCircle className="w-5 h-5 text-red-600" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              {booking.rejection_reason ? "Rejection Reason" : "Admin Notes"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {booking.rejection_reason || booking.admin_notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sticky bottom-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
        {allowsPayment && (
          <Button
            type="button"
            onClick={() => navigate(`/bookings/${booking.id}/payment`)}
            className="flex-1"
            size="lg"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Upload Payment
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/reservations")}
        >
          My Reservations
        </Button>
      </div>
    </div>
  );
}
