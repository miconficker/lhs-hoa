import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Upload } from "lucide-react";

import { api } from "@/lib/api";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export function BookingPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingWithCustomer | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    try {
      setLoading(true);
      const [bookingResult, paymentResult] = await Promise.all([
        api.bookings.get(id!),
        api.public.getPaymentDetails(),
      ]);

      if (bookingResult.error) {
        toast.error(bookingResult.error);
        navigate("/reservations");
        return;
      }

      setBooking(bookingResult.data?.booking || null);
      if (paymentResult.data) setPaymentDetails(paymentResult.data);
    } catch (e) {
      console.error("Error loading booking payment page:", e);
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadProof() {
    if (!id || !proofFile) return;

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      const result = await api.bookings.uploadProofFile(id, proofFile);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Payment proof uploaded");
      navigate(`/bookings/${id}/details`);
    } catch (e) {
      console.error("Error uploading proof:", e);
      toast.error("Failed to upload payment proof");
    } finally {
      setUploading(false);
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
  const canUpload = booking.booking_status === "payment_due";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Upload Payment Proof</h1>
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

      {!canUpload && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Upload is only available when status is <strong>Payment Due</strong>
            . Current status: <strong>{statusConfig.label}</strong>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              ₱{(booking.amount || 0).toLocaleString()}
            </span>
          </div>
          {paymentDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t">
              <div className="rounded-lg border bg-background p-3">
                <div className="font-medium mb-1">GCash</div>
                <div className="text-muted-foreground">
                  {paymentDetails.gcash?.name} • {paymentDetails.gcash?.number}
                </div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <div className="font-medium mb-1">Bank Transfer</div>
                <div className="text-muted-foreground">
                  {paymentDetails.bank_transfer?.bank_name} •{" "}
                  {paymentDetails.bank_transfer?.account_number}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proof of Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Boolean(booking.proof_of_payment_url) ? (
            <div className="text-sm text-muted-foreground">
              Proof already uploaded. You can view it in booking details.
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed rounded-lg p-6">
                <div className="flex flex-col items-center text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload screenshot or receipt (image/PDF, max 5MB)
                  </p>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="max-w-xs"
                    disabled={!canUpload}
                  />
                  {proofFile && (
                    <p className="text-sm mt-2 font-medium">{proofFile.name}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleUploadProof}
                  disabled={!canUpload || uploading || !proofFile}
                  className="flex-1"
                >
                  {uploading ? "Uploading..." : "Upload Proof"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/bookings/${id}/details`)}
                >
                  View Details
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
