import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnifiedBookingCalendar } from "@/components/booking/UnifiedBookingCalendar";
import { BookingHistory } from "@/components/booking/BookingHistory";
import { UnifiedBookingForm } from "@/components/booking/UnifiedBookingForm";
import { useAuth } from "@/hooks/useAuth";
import type { AmenityType, TimeBlockSlot, PricingCalculation } from "@/types";

const RESIDENT_AMENITIES: AmenityType[] = [
  "clubhouse",
  "pool",
  "basketball-court",
  "tennis-court",
];

export function ReservationsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const [selectedAmenity, setSelectedAmenity] = useState<AmenityType>("clubhouse");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeBlockSlot | null>(null);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [error, setError] = useState("");
  const bookingFormRef = useRef<HTMLDivElement | null>(null);

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // This section of the portal is expected to be login-gated. Avoid showing
  // "sign in required" flicker before auth finishes initializing.
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  // Avoid hard redirects here; routing should already be protected and
  // redirecting during render can cause loops during hydration edge cases.
  const canBookAsResident = !!(isAuthenticated && user);

  const loadPricing = useCallback(async () => {
    if (!selectedDate || !selectedSlot) {
      setPricing(null);
      return;
    }

    try {
      setError("");
      setPricing(null);

      const result = await api.bookings.getPricing(
        selectedAmenity,
        selectedDate,
        selectedSlot,
        true, // isResident
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setPricing(result.data as PricingCalculation);
      }
    } catch (err) {
      console.error("Error loading pricing:", err);
      setError("Failed to load pricing");
    }
  }, [selectedAmenity, selectedDate, selectedSlot]);

  // Load pricing when slot is selected
  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  // Make the next step obvious: once a slot is selected (and when pricing later
  // loads), scroll the panel into view.
  useEffect(() => {
    if (showBookingForm && selectedDate && selectedSlot) {
      bookingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showBookingForm, selectedDate, selectedSlot]);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setPricing(null);
    setError("");
  }

  function handleSlotSelect(slot: TimeBlockSlot | null) {
    setSelectedSlot(slot);
    setError("");
  }

  function handleAmenityChange(amenityType: AmenityType) {
    setSelectedAmenity(amenityType);
    setSelectedSlot(null);
    setPricing(null);
    setError("");
  }

  function handleBookingSuccess() {
    setShowBookingForm(false);
    setSelectedDate("");
    setSelectedSlot(null);
    setPricing(null);
    setError("");
    setRefreshKey((prev) => prev + 1);
  }

  function handleNewBooking() {
    setShowBookingForm(true);
  }

  function handleCancelNewBooking() {
    setShowBookingForm(false);
    setSelectedDate("");
    setSelectedSlot(null);
    setPricing(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Reservations</h1>
        {!showBookingForm && canBookAsResident && (
          <Button onClick={handleNewBooking}>
            <Plus className="w-4 h-4 mr-2" />
            New Reservation
          </Button>
        )}
      </div>

      {!canBookAsResident && (
        <Card>
          <CardHeader>
            <CardTitle>Session required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your session is missing or expired. Please sign in again.
            </p>
            <Button onClick={() => (window.location.href = "/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-2 hover:text-red-900">
            ×
          </button>
        </div>
      )}

      {showBookingForm && canBookAsResident && (
        <>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleCancelNewBooking}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <span className="text-sm text-muted-foreground">
              Select an amenity, date, and time slot to book
            </span>
          </div>

          <UnifiedBookingCalendar
            mode="resident"
            initialAmenityType={selectedAmenity}
            availableAmenities={RESIDENT_AMENITIES}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onDateSelect={handleDateSelect}
            onSlotSelect={handleSlotSelect}
            onAmenityChange={handleAmenityChange}
          />

          {/* Next step panel (always shows once slot is selected) */}
          {selectedDate && selectedSlot && (
            <div ref={bookingFormRef} className="space-y-3">
              <div className="p-2 bg-primary/10 border border-primary rounded text-sm flex justify-between items-center">
                <span>
                  Selected slot: <strong>{selectedSlot}</strong> on{" "}
                  <strong>{selectedDate}</strong>
                </span>
                <span className="ml-2">
                  {pricing ? (
                    <span className="font-semibold">
                      ₱{pricing.finalAmount.toLocaleString()}
                    </span>
                  ) : error ? (
                    <span className="text-red-700">Pricing error</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Calculating price…
                    </span>
                  )}
                </span>
              </div>

              {!isAuthenticated || !user ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Session required</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Please sign in again to confirm this reservation.
                    </p>
                    <Button onClick={() => (window.location.href = "/login")}>
                      Go to Login
                    </Button>
                  </CardContent>
                </Card>
              ) : error ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Unable to load pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button
                      variant="outline"
                      onClick={loadPricing}
                    >
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : !pricing ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Preparing confirmation</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading price and details…
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Base rate
                      </span>
                      <span className="font-medium">
                        ₱{pricing.baseRate.toLocaleString()}/hour
                      </span>
                    </CardContent>
                  </Card>

                  <UnifiedBookingForm
                    amenityType={selectedAmenity}
                    date={selectedDate}
                    slot={selectedSlot as TimeBlockSlot}
                    pricing={pricing}
                    onSuccess={handleBookingSuccess}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Booking history */}
      {!showBookingForm && (
        <BookingHistory key={refreshKey} userId={user?.id} />
      )}
    </div>
  );
}
