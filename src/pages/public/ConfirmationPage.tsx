import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PublicBookingResponse } from "@/types";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

const statusConfig = {
  pending_payment: {
    icon: Clock,
    label: "Pending Payment",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    description: "Please upload your proof of payment to proceed",
  },
  pending_verification: {
    icon: Clock,
    label: "Under Review",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    description:
      "We are verifying your payment. You will receive an update within 24-48 hours.",
  },
  confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Your booking has been confirmed! See details below.",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "bg-red-100 text-red-800 border-red-200",
    description: "Your booking request has been declined.",
  },
  cancelled: {
    icon: AlertCircle,
    label: "Cancelled",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    description: "This booking has been cancelled.",
  },
};

export function ConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<PublicBookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      loadBooking();
    }
  }, [id]);

  async function loadBooking() {
    if (!id) return;

    try {
      setLoading(true);
      const result = await api.public.getBookingStatus(id);
      if (result.data) {
        const response = result.data as { booking: PublicBookingResponse };
        setBooking(response.booking);
      }
    } catch (error) {
      console.error("Error loading booking:", error);
      toast.error("Failed to load booking status");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadBooking();
    setRefreshing(false);
  }

  async function handleUploadProof() {
    if (!proofFile || !id) return;

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      // TODO: Implement R2 upload
      const url = `https://r2-storage.example.com/proofs/${Date.now()}-${proofFile.name}`;

      await api.public.uploadPaymentProof(id, url);
      toast.success("Proof of payment uploaded");
      await loadBooking();
      setProofFile(null);
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast.error("Failed to upload proof of payment");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-muted-foreground mb-2">
          Booking Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
          The booking you're looking for doesn't exist.
        </p>
        <Link to="/external-rentals">
          <Button>Browse Amenities</Button>
        </Link>
      </div>
    );
  }

  const status =
    statusConfig[booking.status as keyof typeof statusConfig] ||
    statusConfig.pending_payment;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/external-rentals"
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to Amenities
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Status Banner */}
        <Card className={`border-2 ${status.color} mb-6`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <StatusIcon className="w-8 h-8 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">{status.label}</h2>
                <p className="text-sm opacity-80">{status.description}</p>
                {booking.rejection_reason && (
                  <div className="mt-3 p-3 bg-white/50 rounded-lg">
                    <p className="text-sm font-medium">Reason:</p>
                    <p className="text-sm">{booking.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>
              Reference Number: {booking.reference_number}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amenity</p>
                <p className="font-medium">
                  {booking.amenity_type
                    .replace("-", " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time Slot</p>
                <p className="font-medium">
                  {booking.slot === "AM"
                    ? "Morning (8AM-12PM)"
                    : booking.slot === "PM"
                      ? "Afternoon (1PM-5PM)"
                      : "Full Day (8AM-5PM)"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {new Date(booking.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-bold text-lg">
                  ₱{booking.amount.toLocaleString()}
                </p>
              </div>
            </div>
            {booking.time_of_day && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Request received at {booking.time_of_day}
                </p>
              </div>
            )}
            {booking.admin_notes && (
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-1">
                  Admin Notes:
                </p>
                <p className="text-sm">{booking.admin_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proof of Payment Upload (for pending_payment) */}
        {booking.status === "pending_payment" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Proof of Payment</CardTitle>
              <CardDescription>
                Upload your payment receipt to proceed with your booking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6">
                <div className="flex flex-col items-center text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload screenshot or receipt of your payment
                  </p>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="max-w-xs"
                  />
                  {proofFile && (
                    <p className="text-sm mt-2">{proofFile.name}</p>
                  )}
                </div>
              </div>
              {proofFile && (
                <Button
                  onClick={handleUploadProof}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? "Uploading..." : "Upload Proof"}
                </Button>
              )}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Payment Details:</p>
                <p className="text-sm">
                  GCash: 0917-XXX-XXXX (Laguna Hills HOA)
                </p>
                <p className="text-sm">
                  BPI: XXXX-XXXX-XXXX (Laguna Hills HOA Association)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmed State Info */}
        {booking.status === "confirmed" && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-green-900 mb-2">
                What's Next?
              </h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Arrive 15 minutes before your scheduled time</li>
                <li>• Present your booking confirmation upon arrival</li>
                <li>• Follow all HOA rules and regulations</li>
                <li>• Clean up after your event</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-6">
          <Link to="/external-rentals" className="flex-1">
            <Button variant="outline" className="w-full">
              Make Another Booking
            </Button>
          </Link>
          {booking.status === "pending_payment" && (
            <Link
              to={`/external-rentals/book?amenity=${booking.amenity_type}&date=${booking.date}&slot=${booking.slot}`}
              className="flex-1"
            >
              <Button variant="default" className="w-full">
                Modify Booking
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
