/**
 * Unified Booking Form Component
 *
 * Handles booking information input for both residents and guests.
 * Shows authentication state and provides appropriate options.
 */

import { useState } from "react";
import { LogOut, User, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { AmenityType, TimeBlockSlot, PricingCalculation } from "@/types";

interface UnifiedBookingFormProps {
  amenityType: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  pricing: PricingCalculation;
  onSuccess: (bookingId: string) => void;
}

export function UnifiedBookingForm({
  amenityType,
  date,
  slot,
  pricing,
  onSuccess,
}: UnifiedBookingFormProps) {
  const {
    user,
    guest,
    isAuthenticated,
    isResident,
    isGuest,
    loginWithGoogle,
    logoutGuest,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    event_type: "" as any,
    attendee_count: "",
    purpose: "",
    terms_agreed: false,
  });

  // Guest-only fields (for unauthenticated guests)
  const [guestInfo, setGuestInfo] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error("Please sign in to continue");
      return;
    }

    // Residents should be able to book with minimal friction; guests must
    // explicitly agree to terms.
    if (!isResident && !formData.terms_agreed) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    // For guests without Google SSO, require guest info
    if (isGuest && !guest) {
      if (!guestInfo.first_name || !guestInfo.last_name || !guestInfo.email) {
        toast.error("Please fill in all required fields");
        return;
      }
    }

    try {
      setSubmitting(true);

      const bookingData = {
        amenity_type: amenityType,
        date,
        slot,
        event_type: formData.event_type || undefined,
        attendee_count: formData.attendee_count
          ? Number(formData.attendee_count)
          : undefined,
        purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
      };

      let result;

      if (isResident) {
        // Resident booking
        result = await api.bookings.create(bookingData);
      } else if (isGuest && guest) {
        // Guest with Google SSO
        result = await api.bookings.create(bookingData);
      } else {
        // Guest without SSO - create with guest info
        result = await api.bookings.createGuest({
          ...bookingData,
          guest_first_name: guestInfo.first_name,
          guest_last_name: guestInfo.last_name,
          guest_email: guestInfo.email,
          guest_phone: guestInfo.phone || "",
        });
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking submitted successfully!");
      onSuccess(result.data?.booking?.id || "");
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast.error("Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  const amenityLabels: Record<AmenityType, string> = {
    clubhouse: "Clubhouse",
    pool: "Swimming Pool",
    "basketball-court": "Basketball Court",
    "tennis-court": "Tennis Court",
  };

  const slotLabels: Record<TimeBlockSlot, string> = {
    AM: "Morning (8AM - 12PM)",
    PM: "Afternoon (1PM - 5PM)",
    FULL_DAY: "Full Day (8AM - 5PM)",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isResident ? "Confirm Reservation" : "Your Information"}</CardTitle>
      </CardHeader>
      <CardContent>
        {!isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please sign in to continue with your booking
            </p>

            {/* Anonymous guest form option */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground list-none">
                <span className="inline-flex items-center gap-2">
                  <span>Or continue as guest</span>
                  <span className="group-open:rotate-90 transition-transform">
                    ▶
                  </span>
                </span>
              </summary>

              <div className="mt-4 space-y-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="guest_first_name">First Name *</Label>
                  <Input
                    id="guest_first_name"
                    type="text"
                    value={guestInfo.first_name}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, first_name: e.target.value })
                    }
                    placeholder="Juan"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_last_name">Last Name *</Label>
                  <Input
                    id="guest_last_name"
                    type="text"
                    value={guestInfo.last_name}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, last_name: e.target.value })
                    }
                    placeholder="Dela Cruz"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_email">Email *</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, email: e.target.value })
                    }
                    placeholder="juan@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_phone">Phone Number</Label>
                  <Input
                    id="guest_phone"
                    type="tel"
                    value={guestInfo.phone}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, phone: e.target.value })
                    }
                    placeholder="+63 912 345 6789"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  * Required fields. Phone number is optional but recommended
                  for updates.
                </p>
              </div>
            </details>

            <div className="h-px bg-border my-4" />

            <Button
              onClick={loginWithGoogle}
              className="w-full"
              size="lg"
              variant="outline"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Fast checkout for repeat guests
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User info display */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {guest?.picture ? (
                    <img
                      src={guest.picture}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {user?.first_name || guest?.firstName}{" "}
                      {user?.last_name || guest?.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user?.email || guest?.email}
                    </p>
                    {isResident && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Resident • 50% discount applied
                      </p>
                    )}
                    {isGuest && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Guest
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isGuest) {
                      logoutGuest();
                    } else {
                      // For residents, use the regular logout
                      localStorage.removeItem("hoa_token");
                      localStorage.removeItem("hoa_user");
                      window.location.href = "/login";
                    }
                  }}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Booking summary */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium">Booking Summary</h4>
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">Amenity:</span>{" "}
                  {amenityLabels[amenityType]}
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p>
                  <span className="text-muted-foreground">Time:</span>{" "}
                  {slotLabels[slot]}
                </p>
                <p className="font-semibold">
                  <span className="text-muted-foreground">Total:</span> ₱
                  {pricing.finalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Event details (resident-friendly) */}
            <div className="space-y-2">
              <Label htmlFor="event_type">Event Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, event_type: v })
                }
              >
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Select event type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="birthday">Birthday Party</SelectItem>
                  <SelectItem value="meeting">Meeting/Conference</SelectItem>
                  <SelectItem value="sports">Sports Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendee_count">Expected Attendees</Label>
              <Input
                id="attendee_count"
                type="number"
                min="1"
                max="500"
                value={formData.attendee_count}
                onChange={(e) =>
                  setFormData({ ...formData, attendee_count: e.target.value })
                }
                placeholder="50"
              />
            </div>

            {!isResident && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Additional Notes</Label>
                  <Textarea
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) =>
                      setFormData({ ...formData, purpose: e.target.value })
                    }
                    placeholder="Any special requirements or notes..."
                    rows={3}
                  />
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={formData.terms_agreed}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, terms_agreed: !!v })
                    }
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the terms and conditions and cancellation policy.
                  </label>
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={submitting || (!isResident && !formData.terms_agreed)}
              className="w-full"
              size="lg"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? "Submitting..." : isResident ? "Confirm Reservation" : "Submit Booking Request"}
            </Button>

            {isResident && (
              <p className="text-xs text-center text-muted-foreground">
                As a resident, you receive a 50% discount on all bookings.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
