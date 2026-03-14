import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type {
  AmenityType,
  TimeBlockSlot,
  PublicPricingCalculation,
} from "@/types";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/public/PublicLayout";
import { UnifiedBookingCalendar } from "@/components/booking/UnifiedBookingCalendar";
import { cn } from "@/lib/utils";

const amenityInfo: Record<
  string,
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
};

export function AmenityDetailPage() {
  const { amenityType } = useParams<{ amenityType: AmenityType }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PublicPricingCalculation | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeBlockSlot | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  const info = amenityType ? amenityInfo[amenityType] : null;

  useEffect(() => {
    if (selectedDate && selectedSlot && amenityType) {
      loadPricing();
    } else {
      setPricing(null);
    }
  }, [selectedDate, selectedSlot, amenityType]);

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
        setPricing(result.data as PublicPricingCalculation);
      }
    } catch (error) {
      console.error("Error loading pricing:", error);
    } finally {
      setLoadingPricing(false);
    }
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function handleSlotSelect(slot: TimeBlockSlot | null) {
    setSelectedSlot(slot);
  }

  function handleProceed() {
    navigate(
      `/external-rentals/book?amenity=${amenityType}&date=${selectedDate}&slot=${selectedSlot}`,
    );
  }

  if (!info) {
    return (
      <PublicLayout showBackButton backTo="/external-rentals">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground">
            Amenity not found
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title={info.name} showBackButton backTo="/external-rentals">
      {/* Hero Image */}
      <div className="relative h-64 md:h-80 -mx-4 sm:-mx-8 mt-[-2rem] sm:mt-[-2.5rem]">
        <img
          src={info.image}
          alt={info.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-foreground">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold">{info.name}</h1>
            <p className="text-muted-foreground mt-2">{info.description}</p>
          </div>
        </div>
      </div>

      <div className="py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <UnifiedBookingCalendar
              mode="external"
              initialAmenityType={amenityType}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              onDateSelect={handleDateSelect}
              onSlotSelect={handleSlotSelect}
            />
          </div>

          {/* Pricing Section */}
          <div className="space-y-6">
            {pricing && (
              <Card
                className={cn(
                  user ? "border-green-200 dark:border-green-800" : "",
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Price
                  </CardTitle>
                  {user && (
                    <Badge variant="default">Resident Discount Applied</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rate</span>
                    <span>₱{pricing.base_rate.toLocaleString()}/hour</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{pricing.duration} hours</span>
                  </div>
                  {pricing.resident_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
