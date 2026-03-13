import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function InquiryPendingPage() {
  const { id } = useParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const checkStatus = async () => {
      try {
        const result = await api.public.getInquiryStatus(id);
        if (result.error) {
          setError(result.error);
          return;
        }

        // Handle both response structures: { data: { inquiry: {...} } } or { data: { data: { inquiry: {...} } } }
        let inquiryData = result.data?.inquiry;
        if (!inquiryData && (result.data as any)?.data?.inquiry) {
          inquiryData = (result.data as any).data.inquiry;
        }

        // Debug logging
        console.log("[InquiryPendingPage] API result:", result);
        console.log("[InquiryPendingPage] inquiryData:", inquiryData);

        if (!inquiryData) {
          setError("Inquiry data not found in response");
          setLoading(false);
          return;
        }

        setInquiry(inquiryData);

        // If status changed, redirect appropriately
        if (inquiryData.booking_status === "pending_approval") {
          window.location.href = `/external-rentals/inquiry/${id}/payment`;
        } else if (inquiryData.booking_status === "confirmed") {
          window.location.href = `/external-rentals/confirmation/${id}`;
        } else if (inquiryData.booking_status === "rejected") {
          // Stay on page but show rejection
        }
      } catch (err) {
        console.error("Error checking inquiry status:", err);
        setError("Failed to check inquiry status");
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Poll for status updates every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !inquiry) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-4">
            {error || "Inquiry not found"}
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const isRejected = inquiry.booking_status === "rejected";

  return (
    <PublicLayout
      title="Inquiry Status"
      showBackButton
      backTo="/external-rentals"
    >
      <div className="max-w-3xl mx-auto py-8">
        {isRejected ? (
          // Rejected state
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-900 dark:text-red-100">
                Inquiry Could Not Be Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-700 dark:text-red-300">
                Unfortunately, we are unable to approve your inquiry at this
                time.
              </p>
              {inquiry.rejection_reason && (
                <div className="p-4 bg-background rounded-lg border">
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">
                    {inquiry.rejection_reason}
                  </p>
                </div>
              )}
              <Link to="/external-rentals">
                <Button>Submit a New Inquiry</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          // Pending state
          <>
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Inquiry Under Review
                </CardTitle>
                <CardDescription>
                  We're reviewing your inquiry and will contact you at the
                  contact details you provided to discuss payment.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inquiry Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Reference Number
                    </p>
                    <p className="font-medium">
                      {inquiry.reference_number ||
                        `EXT-${inquiry.id.slice(-8)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Submitted On
                    </p>
                    <p className="font-medium">
                      {new Date(inquiry.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amenity</span>
                    <span className="font-medium">
                      {amenityLabels[inquiry.amenity_type] ||
                        inquiry.amenity_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {new Date(inquiry.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Slot</span>
                    <span className="font-medium">
                      {slotLabels[inquiry.slot]}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">
                      Estimated Amount
                    </span>
                    <span className="font-bold text-lg">
                      ₱{inquiry.amount?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">We'll email you at:</p>
                      <p className="text-muted-foreground">
                        {inquiry.guest_email}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
