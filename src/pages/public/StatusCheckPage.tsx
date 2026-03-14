import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, AlertCircle, Calendar, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";
import {
  StatusPhaseIndicator,
  getStatusPhaseInfo,
} from "@/components/public/StatusPhaseIndicator";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

interface BookingStatusData {
  id: string;
  reference_number: string;
  amenity_type: string;
  date: string;
  slot: string;
  amount: number;
  booking_status: string;
  created_at: string;
}

export function StatusCheckPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(searchParams.get("ref") || "");
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [booking, setBooking] = useState<BookingStatusData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-load if reference number is in URL
  useEffect(() => {
    if (searchParams.get("ref")) {
      handleCheckStatus();
    }
  }, []); // Only run on mount

  async function handleCheckStatus() {
    const trimmed = identifier.trim();

    if (!trimmed) {
      toast.error("Please enter a reference number or booking ID");
      return;
    }

    setLoading(true);
    setNotFound(false);
    setError(null);
    setBooking(null);

    try {
      const result = await api.public.getStatusByIdentifier(trimmed);

      if (result.error) {
        setNotFound(true);
        setError(result.error);
        return;
      }

      if (result.data) {
        const response = result.data as { booking: BookingStatusData };
        setBooking(response.booking);
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setError("Failed to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleCheckStatus();
  }

  function extractIdentifierFromQrValue(rawValue: string): string | null {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;

    // Full URL: https://.../status/<ref> or https://.../status?ref=<ref>
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        const byQuery = url.searchParams.get("ref");
        if (byQuery) return byQuery.trim();

        const match = url.pathname.match(/\/status\/([^/]+)$/);
        if (match?.[1]) return decodeURIComponent(match[1]).trim();
      } catch {
        // ignore parse failure and fall through
      }
    }

    // Raw identifier (reference number or booking UUID)
    if (/^EXT-\d{8}-[a-z0-9]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        trimmed,
      )
    )
      return trimmed;

    // Sometimes scanners return something like "status/EXT-..." or "/status/EXT-..."
    const pathMatch = trimmed.match(/\/status\/([^/]+)$/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();

    return null;
  }

  async function handleQrFileSelected(file: File) {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector as
      | (new (options?: any) => { detect: (image: any) => Promise<any[]> })
      | undefined;

    if (!BarcodeDetectorCtor) {
      toast.error(
        "QR scanning isn't supported in this browser. Please type your reference number instead.",
      );
      return;
    }

    setQrLoading(true);
    try {
      const imageBitmap = await createImageBitmap(file);
      try {
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const barcodes = await detector.detect(imageBitmap);
        const rawValue = barcodes?.[0]?.rawValue as string | undefined;

        if (!rawValue) {
          toast.error("Couldn't read a QR code from that image.");
          return;
        }

        const extracted = extractIdentifierFromQrValue(rawValue);
        if (!extracted) {
          toast.error(
            "QR code read, but it doesn't look like a booking status link.",
          );
          return;
        }

        navigate(`/status/${encodeURIComponent(extracted)}`);
      } finally {
        imageBitmap.close?.();
      }
    } catch (err) {
      console.error("QR decode failed:", err);
      toast.error("Failed to scan QR code. Try a clearer image.");
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <PublicLayout title="Check Booking Status" showBackButton backTo="/">
      <div className="max-w-3xl mx-auto py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Check Your Booking Status</CardTitle>
            <CardDescription>
              Enter your reference number or booking ID to see the current
              status of your booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="identifier" className="sr-only">
                  Reference Number or Booking ID
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g., EXT-20250313-123 or booking ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="text-base"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg">
                {loading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Check Status
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: You can find your reference number in your booking
              confirmation email or on your payment receipt.
            </p>

            <div className="flex items-center gap-3 mt-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-4">
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void handleQrFileSelected(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={qrLoading}
                onClick={() => qrInputRef.current?.click()}
              >
                {qrLoading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : null}
                Upload QR Code Image
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This scans the image locally in your browser. Nothing is
                uploaded.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Not Found State */}
        {notFound && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    Booking Not Found
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    {error ||
                      "Please check your reference number and try again."}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                    If you recently made a booking, it may take a few minutes to
                    appear in our system. Please try again later.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Status Results */}
        {booking && (
          <>
            {/* Phase Indicator */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <StatusPhaseIndicator status={booking.booking_status as any} />
              </CardContent>
            </Card>

            {/* Status Details */}
            <StatusDetailsCard booking={booking} />
          </>
        )}

        {/* Help Section */}
        {!booking && !notFound && (
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                If you don't have your reference number:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>Check your email for the booking confirmation</li>
                <li>Look for SMS notifications with your booking details</li>
                <li>Contact HOA admin for assistance</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}

function StatusDetailsCard({ booking }: { booking: BookingStatusData }) {
  const phaseInfo = getStatusPhaseInfo(booking.booking_status as any);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Details</CardTitle>
        <CardDescription>
          Reference Number:{" "}
          <span className="font-mono font-semibold">
            {booking.reference_number}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Description */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="font-medium mb-1">{phaseInfo.phaseName}</p>
          <p className="text-sm text-muted-foreground">
            {phaseInfo.description}
          </p>
        </div>

        {/* Booking Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">
                {new Date(booking.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Time Slot</p>
              <p className="font-medium">
                {slotLabels[booking.slot] || booking.slot}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <DollarSign className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-bold text-lg">
                ₱{booking.amount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-lg">🏢</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amenity</p>
              <p className="font-medium">
                {amenityLabels[booking.amenity_type] ||
                  booking.amenity_type
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
              </p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            What's Next?
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {phaseInfo.nextStep}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link to="/external-rentals" className="flex-1">
            <Button variant="outline" className="w-full">
              Browse Amenities
            </Button>
          </Link>
          {booking.booking_status === "payment_due" && (
            <Link
              to={`/external-rentals/inquiry/${booking.id}/payment`}
              className="flex-1"
            >
              <Button className="w-full">Upload Payment Proof</Button>
            </Link>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-center text-muted-foreground pt-2">
          Booked on{" "}
          {new Date(booking.created_at).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
