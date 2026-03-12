import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type {
  AmenityType,
  TimeBlockSlot,
  AvailabilitySlot,
  PricingCalculation,
} from "@/types";
import {
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

const amenityInfo: Record<
  AmenityType,
  { name: string; image: string; description: string }
> = {
  clubhouse: {
    name: "Clubhouse",
    image:
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200",
    description:
      "Perfect for weddings, debuts, parties, and meetings. Fully air-conditioned with kitchen access.",
  },
  pool: {
    name: "Swimming Pool",
    image:
      "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1200",
    description:
      "Olympic-sized pool with kiddie area. Great for summer parties and swimming events.",
  },
  "basketball-court": {
    name: "Basketball Court",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200",
    description:
      "Full-size court with lighting. Perfect for tournaments and friendly games.",
  },
  "tennis-court": {
    name: "Tennis Court",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200",
    description:
      "Professional clay court. Great for private lessons and matches.",
  },
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function AmenityDetailPage() {
  const { amenityType } = useParams<{ amenityType: AmenityType }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeBlockSlot | "">("");
  const [loading, setLoading] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(false);

  const info = amenityType ? amenityInfo[amenityType] : null;

  useEffect(() => {
    if (amenityType) {
      loadAvailability();
    }
  }, [amenityType]);

  useEffect(() => {
    if (selectedDate && selectedSlot && amenityType) {
      loadPricing();
    } else {
      setPricing(null);
    }
  }, [selectedDate, selectedSlot, amenityType]);

  async function loadAvailability() {
    if (!amenityType) return;

    try {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const result = await api.public.getAvailability(
        amenityType,
        today,
        threeMonthsLater,
      );
      if (result.data) {
        const response = result.data as { available: AvailabilitySlot[] };
        setAvailability(response.available);
      }
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPricing() {
    if (!amenityType || !selectedDate || !selectedSlot) return;

    try {
      setLoadingPricing(true);
      const result = await api.public.getPricing(
        amenityType,
        selectedDate,
        selectedSlot,
        !!user,
      );
      if (result.data) {
        setPricing(result.data as PricingCalculation);
      }
    } catch (error) {
      console.error("Error loading pricing:", error);
    } finally {
      setLoadingPricing(false);
    }
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot("");
  }

  function handleSlotSelect(slot: TimeBlockSlot) {
    setSelectedSlot(slot);
  }

  function handleProceed() {
    navigate(
      `/external-rentals/book?amenity=${amenityType}&date=${selectedDate}&slot=${selectedSlot}`,
    );
  }

  if (!info) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">
          Amenity not found
        </h1>
        <Link to="/external-rentals">
          <Button variant="link">Back to Amenities</Button>
        </Link>
      </div>
    );
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const byMonth: Record<string, AvailabilitySlot[]> = {};
  availability.forEach((slot) => {
    const month = new Date(slot.date).getMonth();
    const year = new Date(slot.date).getFullYear();
    const key = `${year}-${month}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(slot);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative h-64 md:h-80">
        <img
          src={info.image}
          alt={info.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-6xl mx-auto">
            <Link
              to="/external-rentals"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Amenities
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">{info.name}</h1>
            <p className="text-white/90 mt-2">{info.description}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select a Date
                </CardTitle>
                <CardDescription>
                  Click on an available date to see time slots
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : availability.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No available dates in the next 3 months
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(byMonth).map(([key, slots]) => {
                      const [year, month] = key.split("-").map(Number);
                      return (
                        <div key={key}>
                          <h3 className="font-semibold text-lg mb-3">
                            {monthNames[month]} {year}
                          </h3>
                          <div className="grid grid-cols-7 gap-2">
                            {slots.map((slot) => {
                              const date = new Date(slot.date);
                              const day = date.getDate();
                              const isSelected = selectedDate === slot.date;
                              const isToday =
                                slot.date ===
                                new Date().toISOString().split("T")[0];

                              return (
                                <button
                                  key={slot.date}
                                  onClick={() => handleDateSelect(slot.date)}
                                  className={cn(
                                    "p-3 text-sm rounded-lg border transition-colors",
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : isToday
                                        ? "bg-blue-100 border-blue-300 hover:bg-blue-200"
                                        : "bg-white border-gray-200 hover:bg-gray-50",
                                  )}
                                >
                                  <div className="font-medium">{day}</div>
                                  <div className="text-xs opacity-70">
                                    {date.toLocaleDateString("en-US", {
                                      weekday: "short",
                                    })}
                                  </div>
                                  {isSelected && (
                                    <div className="mt-1 text-xs">
                                      {slot.available_slots.length} slot
                                      {slot.available_slots.length !== 1
                                        ? "s"
                                        : ""}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Slot Selection & Pricing */}
          <div className="space-y-6">
            {selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Available Slots
                  </CardTitle>
                  <CardDescription>
                    {new Date(selectedDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {availability
                    .find((a) => a.date === selectedDate)
                    ?.available_slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => handleSlotSelect(slot as TimeBlockSlot)}
                        className={cn(
                          "w-full p-4 text-left rounded-lg border transition-colors",
                          selectedSlot === slot
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white border-gray-200 hover:bg-gray-50",
                        )}
                      >
                        <div className="font-medium">
                          {slotLabels[slot as TimeBlockSlot]}
                        </div>
                      </button>
                    ))}
                </CardContent>
              </Card>
            )}

            {pricing && (
              <Card className={cn("border-2", user ? "border-green-200" : "")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Pricing Breakdown
                  </CardTitle>
                  {user && (
                    <Badge variant="default">Resident Discount Applied</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Rate</span>
                    <span>₱{pricing.base_rate}/hour</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{pricing.duration} hours</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Day Type</span>
                    <span className="capitalize">{pricing.day_type}</span>
                  </div>
                  {pricing.day_multiplier !== 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Day Multiplier
                      </span>
                      <span>x{pricing.day_multiplier}</span>
                    </div>
                  )}
                  {pricing.season_multiplier !== 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Season</span>
                      <span className="capitalize">
                        {pricing.season_type} (x{pricing.season_multiplier})
                      </span>
                    </div>
                  )}
                  {pricing.resident_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Resident Discount</span>
                      <span>-{pricing.resident_discount * 100}%</span>
                    </div>
                  )}
                  <div className="pt-3 border-t flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>₱{pricing.final_price.toLocaleString()}</span>
                  </div>
                  <Button
                    onClick={handleProceed}
                    className="w-full"
                    size="lg"
                    disabled={loadingPricing}
                  >
                    Proceed to Booking
                  </Button>
                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">
                      Log in to get 50% resident discount
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
