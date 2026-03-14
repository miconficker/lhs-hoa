import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type {
  AmenityType,
  TimeBlockSlot,
  PublicPricingCalculation,
  PaymentDetails,
  PublicBookingRequest,
} from "@/types";
import { Upload, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

const eventTypes = [
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday Party" },
  { value: "meeting", label: "Meeting/Conference" },
  { value: "sports", label: "Sports Event" },
  { value: "other", label: "Other" },
];

export function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const amenityType = searchParams.get("amenity") as AmenityType;
  const date = searchParams.get("date") || "";
  const slot = searchParams.get("slot") as TimeBlockSlot;

  const [pricing, setPricing] = useState<PublicPricingCalculation | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    guest_first_name: user?.first_name || "",
    guest_last_name: user?.last_name || "",
    guest_email: user?.email || "",
    guest_phone: "",
    event_type: "" as any,
    attendees: "",
    purpose: "",
    terms_agreed: false,
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadedProofUrl, setUploadedProofUrl] = useState("");

  useEffect(() => {
    if (!amenityType || !date || !slot) {
      navigate("/external-rentals");
      return;
    }

    loadData();
  }, [amenityType, date, slot]);

  async function loadData() {
    try {
      setLoading(true);
      const [pricingResult, paymentResult] = await Promise.all([
        api.public.getPricing(amenityType, date, slot, !!user),
        api.public.getPaymentDetails(),
      ]);

      if (pricingResult.data) {
        setPricing(pricingResult.data as PublicPricingCalculation);
      }
      if (paymentResult.data) {
        setPaymentDetails(paymentResult.data as PaymentDetails);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load booking information");
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
      setUploadedProofUrl(url);
      toast.success("Proof of payment uploaded");
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast.error("Failed to upload proof of payment");
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.terms_agreed) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    if (
      formData.attendees &&
      (parseInt(formData.attendees) < 1 || parseInt(formData.attendees) > 500)
    ) {
      toast.error("Number of attendees must be between 1 and 500");
      return;
    }

    try {
      setSubmitting(true);

      const bookingData: PublicBookingRequest = {
        amenity_type: amenityType,
        date,
        slot,
        guest_first_name: formData.guest_first_name,
        guest_last_name: formData.guest_last_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone,
        event_type: formData.event_type,
        attendees: parseInt(formData.attendees) || 0,
        purpose: formData.purpose,
        proof_of_payment_url: uploadedProofUrl || undefined,
      };

      const result = await api.public.createBooking(bookingData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking request submitted!");
      navigate(`/external-rentals/success/${result.data?.booking.id}`);
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast.error("Failed to submit booking request");
    } finally {
      setSubmitting(false);
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

  if (!pricing) {
    return (
      <PublicLayout showBackButton backTo="/external-rentals">
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground">
            Unable to load pricing
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout
      title="Book Amenity"
      showBackButton
      backTo={`/external-rentals/${amenityType}`}
    >
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-2">Complete Your Booking</h1>
        <p className="text-muted-foreground mb-8">
          Fill in your details to submit a booking request for{" "}
          <strong>{amenityLabels[amenityType]}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amenity</span>
                <span className="font-medium">
                  {amenityLabels[amenityType]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Slot</span>
                <span className="font-medium">{slotLabels[slot]}</span>
              </div>
              {user && pricing.resident_discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Resident Discount</span>
                  <span>-{pricing.resident_discount * 100}%</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between font-bold text-lg">
                <span>Total Amount</span>
                <span>₱{pricing.final_price.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>
                Please provide your contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guest_first_name">First Name *</Label>
                  <Input
                    id="guest_first_name"
                    value={formData.guest_first_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        guest_first_name: e.target.value,
                      })
                    }
                    placeholder="Juan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_last_name">Last Name *</Label>
                  <Input
                    id="guest_last_name"
                    value={formData.guest_last_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        guest_last_name: e.target.value,
                      })
                    }
                    placeholder="Dela Cruz"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_email">Email Address *</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_email: e.target.value })
                  }
                  placeholder="juan@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone Number *</Label>
                <Input
                  id="guest_phone"
                  type="tel"
                  value={formData.guest_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_phone: e.target.value })
                  }
                  placeholder="+63 912 345 6789"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Tell us about your event</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, event_type: v })
                  }
                  required
                >
                  <SelectTrigger id="event_type">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendees">
                  Expected Number of Attendees *
                </Label>
                <Input
                  id="attendees"
                  type="number"
                  min="1"
                  max="500"
                  value={formData.attendees}
                  onChange={(e) =>
                    setFormData({ ...formData, attendees: e.target.value })
                  }
                  placeholder="50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Event Purpose/Description *</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  placeholder="Describe your event..."
                  rows={3}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          {paymentDetails && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
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
                  {amenityLabels[amenityType]} - {date}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Proof of Payment Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Proof of Payment</CardTitle>
              <CardDescription>
                Upload your payment receipt (optional for now, required for
                confirmation)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!uploadedProofUrl ? (
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
                      {uploadingProof ? "Uploading..." : "Upload Proof"}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Proof uploaded
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      You can upload again if needed
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadedProofUrl("");
                      setProofFile(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                You can also upload your proof later through the confirmation
                page.
              </p>
            </CardContent>
          </Card>

          {/* Terms & Conditions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={formData.terms_agreed}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, terms_agreed: !!v })
                  }
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  I agree to the{" "}
                  <Link
                    to="/external-rentals/terms"
                    target="_blank"
                    className="text-primary underline"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  for external amenity rentals *
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Booking Request"}
            </Button>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}
