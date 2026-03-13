import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type {
  AmenityType,
  TimeBlockSlot,
  PricingCalculation,
  PublicInquiryRequest,
} from "@/types";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
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

export function InquiryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const amenityType = searchParams.get("amenity") as AmenityType;
  const date = searchParams.get("date") || "";
  const slot = searchParams.get("slot") as TimeBlockSlot;

  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    guest_name:
      user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : "",
    guest_email: user?.email || "",
    guest_phone: "",
    event_type: "" as any,
    attendees: "",
    purpose: "",
    terms_agreed: false,
  });

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
      const pricingResult = await api.public.getPricing(
        amenityType,
        date,
        slot,
        !!user,
      );

      if (pricingResult.data) {
        setPricing(pricingResult.data as PricingCalculation);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load booking information");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.terms_agreed) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    // Validate attendees
    const attendeeCount = parseInt(formData.attendees);
    if (
      !formData.attendees ||
      isNaN(attendeeCount) ||
      attendeeCount < 1 ||
      attendeeCount > 500
    ) {
      toast.error("Number of attendees must be between 1 and 500");
      return;
    }

    // Validate phone number (at least 10 digits, auto-formatted with +63)
    const phoneDigits = formData.guest_phone.replace(/\D/g, "");
    if (
      !formData.guest_phone ||
      phoneDigits.length < 10 ||
      !phoneDigits.startsWith("63")
    ) {
      toast.error(
        "Please enter a valid Philippine mobile number (auto-formatted to +63)",
      );
      return;
    }

    // Validate purpose (at least 10 characters)
    if (!formData.purpose || formData.purpose.trim().length < 10) {
      toast.error("Please provide a description (at least 10 characters)");
      return;
    }

    // Validate event type
    if (!formData.event_type) {
      toast.error("Please select an event type");
      return;
    }

    try {
      setSubmitting(true);

      const inquiryData: PublicInquiryRequest = {
        amenity_type: amenityType,
        date,
        slot,
        guest_name: formData.guest_name.trim(),
        guest_email: formData.guest_email.trim(),
        guest_phone: formData.guest_phone.trim(),
        event_type: formData.event_type,
        attendees: attendeeCount,
        purpose: formData.purpose.trim(),
      };

      const result = await api.public.createInquiry(inquiryData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Inquiry submitted!");
      // Redirect to inquiry pending page instead of success page
      navigate(`/external-rentals/inquiry/${result.data?.inquiry.id}/pending`);
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      toast.error("Failed to submit inquiry");
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
      title="Submit Your Inquiry"
      showBackButton
      backTo={`/external-rentals/${amenityType}`}
    >
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-2">Submit Your Inquiry</h1>
        <p className="text-muted-foreground mb-8">
          Fill in your details to submit an inquiry for{" "}
          <strong>{amenityLabels[amenityType]}</strong>. We'll review it and get
          back to you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Inquiry Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Inquiry Summary</CardTitle>
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
                <span>Estimated Amount</span>
                <span>₱{pricing.final_price.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                * Pricing is subject to approval. Final amount will be confirmed
                after inquiry review.
              </p>
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
              <div className="space-y-2">
                <Label htmlFor="guest_name">Full Name *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_name: e.target.value })
                  }
                  placeholder="Juan Dela Cruz"
                  required
                />
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
              <PhoneInput
                id="guest_phone"
                label="Phone Number"
                value={formData.guest_phone}
                onChange={(value) =>
                  setFormData({ ...formData, guest_phone: value })
                }
                placeholder="912 345 6789"
                required
              />
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

          {/* Approval Notice */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Your inquiry will be reviewed by our
                team. Once approved, you will receive an email with payment
                instructions. The time slot will only be blocked after payment
                is verified.
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
              {submitting ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}
