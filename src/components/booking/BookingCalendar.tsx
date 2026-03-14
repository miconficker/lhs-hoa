/**
 * Shared Booking Calendar Component
 *
 * Displays available dates and slots for booking amenities.
 * Works for both residents and external guests.
 */

import { format, isWeekend, isToday, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AmenityType, TimeBlockSlot } from "@/types";

interface BookingCalendarProps {
  amenityType: AmenityType;
  availableAmenities: AmenityType[];
  selectedDate: string;
  selectedSlot: TimeBlockSlot | null;
  existingBookings: Array<{ slot: TimeBlockSlot; status: string }>;
  closures: Array<{ slot: TimeBlockSlot; reason: string }>;
  onDateSelect: (date: string) => void;
  onSlotSelect: (slot: TimeBlockSlot) => void;
  onAmenityChange: (amenityType: AmenityType) => void;
}

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

export function BookingCalendar({
  amenityType,
  availableAmenities,
  selectedDate,
  selectedSlot,
  existingBookings,
  closures,
  onDateSelect,
  onSlotSelect,
  onAmenityChange,
}: BookingCalendarProps) {
  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    const currentDate = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      dates.push(format(date, "yyyy-MM-dd"));
    }

    return dates;
  };

  const dates = generateDates();

  const getSlotStatus = (slot: TimeBlockSlot) => {
    // Check closures first
    const closure = closures.find((c) => c.slot === slot);
    if (closure) {
      return { available: false, reason: `Closed: ${closure.reason}` };
    }

    // Check existing bookings
    const booking = existingBookings.find((b) => b.slot === slot);
    if (booking) {
      return { available: false, reason: `Booked` };
    }

    return { available: true };
  };

  return (
    <div className="space-y-6">
      {/* Amenity Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Amenity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableAmenities.map((amenity) => (
              <button
                key={amenity}
                onClick={() => onAmenityChange(amenity)}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-left",
                  amenityType === amenity
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50",
                )}
              >
                <div className="font-medium">{amenityLabels[amenity]}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {dates.map((date) => {
              const dateObj = parseISO(date);
              const past = isPast(dateObj) && !isToday(dateObj);
              const weekend = isWeekend(dateObj);

              return (
                <button
                  key={date}
                  onClick={() => !past && onDateSelect(date)}
                  disabled={past}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    selectedDate === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : past
                        ? "border-muted bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50"
                        : weekend
                          ? "border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/20"
                          : "border-border hover:border-primary/50 hover:bg-muted/50",
                    "disabled:opacity-50",
                  )}
                >
                  <div className="text-xs font-medium">
                    {format(dateObj, "MMM")}
                  </div>
                  <div className="text-lg font-bold">
                    {format(dateObj, "d")}
                  </div>
                  <div className="text-xs">{format(dateObj, "EEE")}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Slot Selection */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>Select Time Slot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["AM", "PM", "FULL_DAY"] as TimeBlockSlot[]).map((slot) => {
                const status = getSlotStatus(slot);
                const available = status.available;

                return (
                  <button
                    key={slot}
                    onClick={() => available && onSlotSelect(slot)}
                    disabled={!available}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      selectedSlot === slot
                        ? "border-primary bg-primary/10"
                        : available
                          ? "border-border hover:border-primary/50 hover:bg-muted/50"
                          : "border-muted bg-muted/50 cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{slotLabels[slot]}</div>
                        {!available && status.reason && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {status.reason}
                          </div>
                        )}
                        {available && (
                          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                            Available
                          </div>
                        )}
                      </div>
                      {selectedSlot === slot && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
