import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

import { api } from "@/lib/api";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { BookingWithCustomer } from "@/types";

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
      <div className="flex justify-center items-center py-12">
        <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary" />
      </div>
    );
  }

  if (!booking) return null;

  const statusConfig = getStatusConfig(booking.booking_status);
  const statusColors = getStatusColorClasses(booking.booking_status);
  const allowsPayment = booking.booking_status === "payment_due";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-sm text-muted-foreground">
            {amenityLabels[booking.amenity_type]} •{" "}
            {new Date(booking.date).toLocaleDateString()} •{" "}
            {slotLabels[booking.slot]}
          </p>
        </div>
        <Badge
          variant={statusConfig.variant}
          className={cn(
            "gap-1",
            statusColors.border,
            statusColors.bg,
            statusColors.text,
          )}
        >
          <statusConfig.icon className="w-3 h-3" />
          {statusConfig.label}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Amount" value={`₱${(booking.amount || 0).toLocaleString()}`} />
          <Row label="Payment Status" value={booking.payment_status || "unpaid"} />
          <Row label="Amount Paid" value={`₱${(booking.amount_paid || 0).toLocaleString()}`} />
          {booking.admin_notes && <Row label="Admin Notes" value={booking.admin_notes} />}
          {booking.rejection_reason && (
            <Row label="Rejection Reason" value={booking.rejection_reason} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {booking.proof_of_payment_url ? (
            <div className="text-muted-foreground">
              Proof uploaded (admin will review).
            </div>
          ) : (
            <div className="text-muted-foreground">No proof uploaded yet.</div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
        {allowsPayment && (
          <Button
            type="button"
            onClick={() => navigate(`/bookings/${booking.id}/payment`)}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Upload Payment
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => navigate("/reservations")}>
          My Reservations
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-right">{value}</div>
    </div>
  );
}
