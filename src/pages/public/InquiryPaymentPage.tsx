import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";
import { QRCodeDisplay } from "@/components/public/QRCodeDisplay";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function InquiryPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;

    try {
      setLoading(true);
      const [statusResult, paymentResult] = await Promise.all([
        api.public.getInquiryStatus(id),
        api.public.getPaymentDetails(),
      ]);

      if (statusResult.error) {
        toast.error(statusResult.error);
        navigate("/external-rentals");
        return;
      }

      const inquiryData = statusResult.data?.inquiry;
      setInquiry(inquiryData);

      // Only show payment details if approved
      if (
        inquiryData.booking_status === "pending_approval" ||
        inquiryData.booking_status === "pending_payment"
      ) {
        if (paymentResult.data) {
          setPaymentDetails(paymentResult.data);
        }
      }

      // Redirect if already confirmed
      if (inquiryData.booking_status === "confirmed") {
        navigate(`/external-rentals/confirmation/${id}`);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load payment information");
    } finally {
      setLoading(false);
    }
  }

  async function handleProofUpload(file: File): Promise<string> {
    // TODO: Implement R2 upload
    // For now, return a mock URL
    return `https://r2-storage.example.com/proofs/${Date.now()}-${file.name}`;
  }

  async function handleUploadProof() {
    if (!proofFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setUploadingProof(true);
      const url = await handleProofUpload(proofFile);

      // Upload proof via API
      const result = await api.public.uploadProof(id!, { proof_url: url });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Proof of payment uploaded");
      // Navigate to confirmation page
      navigate(`/external-rentals/confirmation/${id}`);
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast.error("Failed to upload proof of payment");
    } finally {
      setUploadingProof(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PublicLayout>
    );
  }

  if (!inquiry) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground">
            Inquiry not found
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const isApproved = inquiry.booking_status === "pending_payment";
  const hasProof = inquiry.booking_status === "pending_verification";

  return (
    <PublicLayout title="Complete Payment" showBackButton>
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-2">Complete Your Payment</h1>
        <p className="text-muted-foreground mb-8">
          Your inquiry for{" "}
          <strong>{amenityLabels[inquiry.amenity_type]}</strong> has been
          approved!
        </p>

        {!isApproved && !hasProof && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium">Payment Not Yet Available</p>
                  <p className="text-sm text-muted-foreground">
                    Your inquiry is still being reviewed. We'll email you when
                    it's approved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isApproved && (
          <>
            {/* Booking Summary */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amenity</span>
                  <span className="font-medium">
                    {amenityLabels[inquiry.amenity_type]}
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
                <div className="pt-2 border-t flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span>₱{inquiry.amount?.toLocaleString() || "0"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Instructions */}
            {paymentDetails && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 mb-6">
                <CardHeader>
                  <CardTitle>Payment Instructions</CardTitle>
                  <CardDescription>
                    Please pay the total amount to complete your booking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">GCash</h4>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-sm">
                        <strong>Name:</strong> {paymentDetails.gcash.name}
                      </p>
                      <p className="text-sm">
                        <strong>Number:</strong> {paymentDetails.gcash.number}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Bank Transfer</h4>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-sm">
                        <strong>Bank:</strong>{" "}
                        {paymentDetails.bank_transfer.bank_name}
                      </p>
                      <p className="text-sm">
                        <strong>Account Name:</strong>{" "}
                        {paymentDetails.bank_transfer.account_name}
                      </p>
                      <p className="text-sm">
                        <strong>Account Number:</strong>{" "}
                        {paymentDetails.bank_transfer.account_number}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reference number format: Your Name -{" "}
                    {amenityLabels[inquiry.amenity_type]} - {inquiry.date}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Proof of Payment Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Proof of Payment</CardTitle>
                <CardDescription>
                  Upload your payment receipt to confirm your booking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasProof ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Payment proof uploaded
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        We'll verify your payment and confirm your booking soon.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/external-rentals/confirmation/${id}`)
                      }
                    >
                      View Status
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-dashed rounded-lg p-6">
                      <div className="flex flex-col items-center text-center">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload screenshot or receipt of your payment
                        </p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) =>
                            setProofFile(e.target.files?.[0] || null)
                          }
                          className="hidden"
                          id="proof-upload"
                        />
                        <label htmlFor="proof-upload">
                          <Button type="button" variant="outline" asChild>
                            <span>Choose File</span>
                          </Button>
                        </label>
                        {proofFile && (
                          <p className="text-sm mt-2">{proofFile.name}</p>
                        )}
                      </div>
                    </div>
                    {proofFile && (
                      <Button
                        type="button"
                        onClick={handleUploadProof}
                        disabled={uploadingProof}
                        className="w-full"
                      >
                        {uploadingProof
                          ? "Uploading..."
                          : "Upload Proof & Confirm Booking"}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* QR Code for Status Check */}
            {isApproved && (
              <Card>
                <CardContent className="pt-6">
                  <QRCodeDisplay
                    value={`${window.location.origin}/status/${inquiry.id}`}
                    title="Quick Status Check"
                    description="Scan this QR code to check your booking status anytime"
                    size={180}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
