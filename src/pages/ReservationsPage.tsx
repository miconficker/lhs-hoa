import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { BookingHistory } from "@/components/booking/BookingHistory";
import { UnifiedBookingForm } from "@/components/booking/UnifiedBookingForm";
import type { AmenityType, TimeBlockSlot, PricingCalculation } from "@/types";

// Residents get all 4 amenities
const RESIDENT_AMENITIES: AmenityType[] = [
  "clubhouse",
  "pool",
  "basketball-court",
  "tennis-court",
];

export function ReservationsPage() {
  const [selectedAmenity, setSelectedAmenity] =
    useState<AmenityType>("clubhouse");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeBlockSlot | null>(null);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [existingBookings, setExistingBookings] = useState<
    Array<{ slot: TimeBlockSlot; status: string }>
  >([]);
  const [closures, setClosures] = useState<
    Array<{ slot: TimeBlockSlot; reason: string }>
  >([]);

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load availability and pricing when date/slot changes
  useEffect(() => {
    if (!selectedDate) return;

    async function loadAvailability() {
      try {
        const result = await api.bookings.getAvailability(
          selectedAmenity,
          selectedDate,
        );
        if (result.data) {
          // Transform available_slots to existingBookings format
          // Slots NOT in available_slots are booked
          const allSlots: TimeBlockSlot[] = ["AM", "PM", "FULL_DAY"];
          const bookedSlots = allSlots.filter(
            (slot) => !result.data?.available_slots.includes(slot),
          );

          setExistingBookings(
            bookedSlots.map((slot) => ({ slot, status: "confirmed" })),
          );
          setClosures(
            (result.data.closures || []).map((c) => ({
              slot: c.slot as TimeBlockSlot,
              reason: c.reason,
            })),
          );
        }
      } catch (error) {
        console.error("Error loading availability:", error);
      }
    }

    loadAvailability();
  }, [selectedAmenity, selectedDate]);

  // Load pricing when slot is selected
  useEffect(() => {
    if (!selectedDate || !selectedSlot) {
      setPricing(null);
      return;
    }

    async function loadPricing() {
      try {
        const result = await api.bookings.getPricing(
          selectedAmenity,
          selectedDate,
          selectedSlot as TimeBlockSlot,
          true, // isResident
        );
        if (result.data) {
          setPricing(result.data as PricingCalculation);
        }
      } catch (error) {
        console.error("Error loading pricing:", error);
      }
    }

    loadPricing();
  }, [selectedAmenity, selectedDate, selectedSlot]);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setPricing(null);
  }

  function handleSlotSelect(slot: TimeBlockSlot) {
    setSelectedSlot(slot);
  }

  function handleAmenityChange(amenityType: AmenityType) {
    setSelectedAmenity(amenityType);
    setSelectedSlot(null);
    setPricing(null);
  }

  function handleBookingSuccess() {
    setShowBookingForm(false);
    setSelectedDate("");
    setSelectedSlot(null);
    setPricing(null);
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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Reservations</h1>
        {!showBookingForm && (
          <Button onClick={handleNewBooking}>
            <Plus className="w-4 h-4 mr-2" />
            New Reservation
          </Button>
        )}
      </div>

      {/* Show booking form when requested */}
      {showBookingForm && (
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

          <BookingCalendar
            amenityType={selectedAmenity}
            availableAmenities={RESIDENT_AMENITIES}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            existingBookings={existingBookings}
            closures={closures}
            onDateSelect={handleDateSelect}
            onSlotSelect={handleSlotSelect}
            onAmenityChange={handleAmenityChange}
          />

          {selectedDate && selectedSlot && pricing && (
            <UnifiedBookingForm
              amenityType={selectedAmenity}
              date={selectedDate}
              slot={selectedSlot as TimeBlockSlot}
              pricing={pricing}
              onSuccess={handleBookingSuccess}
            />
          )}
        </>
      )}

      {/* Show booking history */}
      {!showBookingForm && <BookingHistory key={refreshKey} />}
    </div>
  );
}
