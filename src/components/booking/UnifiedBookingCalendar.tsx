/**
 * Unified Booking Calendar Component
 *
 * Responsive, single-month calendar with icon indicators for available slots.
 * Sunday-Saturday week layout.
 */

import { useState, useCallback, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  isPast,
  isToday,
  isSameDay,
  differenceInCalendarMonths,
} from "date-fns";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarLegend } from "./CalendarLegend";
import { useCalendarAvailability } from "./useCalendarAvailability";
import type { AmenityType, TimeBlockSlot } from "@/types";

interface UnifiedBookingCalendarProps {
  mode: "resident" | "external";
  initialAmenityType?: AmenityType;
  availableAmenities?: AmenityType[];
  selectedDate: string;
  selectedSlot: TimeBlockSlot | null;
  onDateSelect: (date: string) => void;
  onSlotSelect: (slot: TimeBlockSlot | null) => void;
  onAmenityChange?: (amenityType: AmenityType) => void;
  bookingHorizonMonths?: number;
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

const DEFAULT_RESIDENT_AMENITIES: AmenityType[] = [
  "clubhouse",
  "pool",
  "basketball-court",
  "tennis-court",
];
const DEFAULT_EXTERNAL_AMENITY: AmenityType = "clubhouse";

export function UnifiedBookingCalendar({
  mode,
  initialAmenityType,
  availableAmenities,
  selectedDate,
  selectedSlot,
  onDateSelect,
  onSlotSelect,
  onAmenityChange,
  bookingHorizonMonths = 12,
}: UnifiedBookingCalendarProps) {
  const amenities =
    availableAmenities ??
    (mode === "resident"
      ? DEFAULT_RESIDENT_AMENITIES
      : [DEFAULT_EXTERNAL_AMENITY]);

  const [currentAmenity, setCurrentAmenity] = useState<AmenityType>(() => {
    if (initialAmenityType && amenities.includes(initialAmenityType)) return initialAmenityType;
    return amenities[0];
  });

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const [selectedDateObj, setSelectedDateObj] = useState<Date | undefined>(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      if (!isNaN(date.getTime())) return date;
    }
    return undefined;
  });

  const {
    loading: availabilityLoading,
    error: availabilityError,
    loadMonth,
    getAvailabilityForDate,
    isSlotAvailable,
  } = useCalendarAvailability({
    mode,
    amenityType: currentAmenity,
    bookingHorizonMonths,
    initialLoadMonths: 2,
  });

  useEffect(() => {
    const fetchMonth = async () => await loadMonth(currentMonth);
    fetchMonth();
  }, [currentMonth, loadMonth]);

  const handleAmenityChange = useCallback(
    (amenityType: AmenityType) => {
      setCurrentAmenity(amenityType);
      onAmenityChange?.(amenityType);
      setCurrentMonth(new Date());
      setSelectedDateObj(undefined);
      onDateSelect("");
      onSlotSelect(null);
    },
    [onAmenityChange, onDateSelect, onSlotSelect]
  );

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      setSelectedDateObj(date);
      onDateSelect(format(date, "yyyy-MM-dd"));
      onSlotSelect(null);
    },
    [onDateSelect, onSlotSelect]
  );

  const handleSlotSelect = useCallback(
    (slot: TimeBlockSlot) => {
      if (selectedDateObj && isSlotAvailable(selectedDateObj, slot)) onSlotSelect(slot);
    },
    [selectedDateObj, isSlotAvailable, onSlotSelect]
  );

  const goToPreviousMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), []);
  const goToNextMonth = useCallback(() => {
    const nextMonth = addMonths(currentMonth, 1);
    if (differenceInCalendarMonths(nextMonth, new Date()) < bookingHorizonMonths) setCurrentMonth(nextMonth);
  }, [currentMonth, bookingHorizonMonths]);
  const goToToday = useCallback(() => setCurrentMonth(new Date()), []);

  const isDateDisabled = useCallback(
    (date: Date) => (isPast(date) && !isToday(date)) || differenceInCalendarMonths(date, new Date()) >= bookingHorizonMonths,
    [bookingHorizonMonths]
  );

  const selectedDateAvailableSlots = selectedDateObj ? getAvailabilityForDate(selectedDateObj) : [];

  return (
    <div className="space-y-6">
      {/* Amenity Selection */}
      {mode === "resident" && amenities.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Amenity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {amenities.map(amenity => (
                <button
                  key={amenity}
                  onClick={() => handleAmenityChange(amenity)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all text-left",
                    currentAmenity === amenity
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  <div className="font-medium">{amenityLabels[amenity]}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {availabilityError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {availabilityError}
        </div>
      )}

      <CalendarLegend />

      {/* Calendar */}
      <Card className="overflow-x-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <CardTitle className="text-xl">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goToToday} disabled={isSameDay(currentMonth, new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth} disabled={differenceInCalendarMonths(addMonths(currentMonth, 1), new Date()) >= bookingHorizonMonths}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center overflow-x-auto">
          <DayPicker
            mode="single"
            selected={selectedDateObj}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays={false}
            fixedWeeks
            className="w-full max-w-full sm:max-w-[90%] md:max-w-[600px]"
            components={{
              DayButton: (props: DayButtonProps) => {
                const { day, modifiers, ...rest } = props;
                if (!day.date) return <button {...rest} />;

                const date: Date = day.date;
                const availableSlots = getAvailabilityForDate(date);

                return (
                  <button
                    {...rest}
                    disabled={modifiers.disabled}
                    className={cn(
                      "flex flex-col items-center justify-center min-h-[80px] p-2 m-0 border rounded hover:border-primary/70 transition-all flex-1 max-w-[80px] sm:max-w-[100px] md:max-w-[120px]",
                      modifiers.selected && "bg-primary/20 border-primary",
                      modifiers.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-sm font-medium">{date.getDate()}</span>
                    <div className="flex gap-1 mt-1 justify-center flex-wrap">
                      {(["AM", "PM", "FULL_DAY"] as TimeBlockSlot[]).map((slot) => {
                        const available = availableSlots.includes(slot);
                        const icon = {
                          AM: <Sun className="w-4 h-4" />,
                          PM: <Moon className="w-4 h-4" />,
                          FULL_DAY: <CalendarIcon className="w-4 h-4" />,
                        }[slot];

                        return (
                          <span
                            key={slot}
                            className={cn(
                              "w-6 h-6 flex items-center justify-center",
                              available ? "text-green-500" : "text-muted-foreground opacity-50"
                            )}
                            title={slotLabels[slot]}
                          >
                            {icon}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Slot Selection */}
      {selectedDateObj && (
        <Card>
          <CardHeader>
            <CardTitle>Available Slots for {format(selectedDateObj, "MMMM d, yyyy")}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateAvailableSlots.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {availabilityLoading ? "Loading availability..." : "No slots available for this date"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["AM", "PM", "FULL_DAY"] as TimeBlockSlot[]).map(slot => {
                  const available = selectedDateAvailableSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!available}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        selectedSlot === slot
                          ? "border-primary bg-primary/10"
                          : available
                            ? "border-border hover:border-primary/50 hover:bg-muted/50"
                            : "border-muted bg-muted/50 cursor-not-allowed opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{slotLabels[slot]}</div>
                          {!available && <div className="text-sm text-muted-foreground mt-1">Not Available</div>}
                          {available && selectedSlot !== slot && <div className="text-sm text-green-600 dark:text-green-400 mt-1">Available</div>}
                        </div>
                        {selectedSlot === slot && <Badge variant="default">Selected</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}