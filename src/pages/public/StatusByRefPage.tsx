import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";
import {
  StatusPhaseIndicator,
  getStatusPhaseInfo,
} from "@/components/public/StatusPhaseIndicator";
import { api } from "@/lib/api";

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

export function StatusByRefPage() {
  const { ref } = useParams<{ ref: string }>();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingStatusData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ref) {
      loadStatus();
    }
  }, [ref]);

  async function loadStatus() {
    if (!ref) return;

    setLoading(true);
    setNotFound(false);
    setError(null);
    setBooking(null);

    try {
      const result = await api.public.getStatusByIdentifier(ref);

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
      console.error("Error loading status:", err);
      setError("Failed to load booking status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout title="Booking Status" showBackButton backTo="/status">
      <div className="max-w-3xl mx-auto py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <LoadingSpinner size="lg" />
          </div>
        ) : notFound ? (
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
                  <div className="flex gap-3 mt-4">
                    <Link to="/status" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Check Another Status
                      </Button>
                    </Link>
                    <Link to="/external-rentals" className="flex-1">
                      <Button size="sm" className="w-full">
                        Browse Amenities
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : booking ? (
          <>
            {/* Reference Number Header */}
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-1">
                Reference Number
              </p>
              <p className="text-2xl font-mono font-bold">
                {booking.reference_number}
              </p>
            </div>

            {/* Phase Indicator */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <StatusPhaseIndicator status={booking.booking_status as any} />
              </CardContent>
            </Card>

            {/* Status Details */}
            <StatusDetailsCard booking={booking} />
          </>
        ) : null}
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
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-lg">📅</span>
            </div>
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
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-lg">🕐</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time Slot</p>
              <p className="font-medium">
                {slotLabels[booking.slot] || booking.slot}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-lg">💰</span>
            </div>
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
          <Link to="/status" className="flex-1">
            <Button variant="outline" className="w-full">
              Check Another Status
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
