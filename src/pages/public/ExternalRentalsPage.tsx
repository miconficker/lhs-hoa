import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PublicAmenity } from "@/types";
import { Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const amenityImages: Record<string, string> = {
  clubhouse:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800",
  pool: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800",
  "basketball-court":
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
  "tennis-court":
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
};

export function ExternalRentalsPage() {
  const [amenities, setAmenities] = useState<PublicAmenity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAmenities();
  }, []);

  async function loadAmenities() {
    try {
      setLoading(true);
      const result = await api.public.getAmenities();
      if (result.data) {
        const response = result.data as { amenities: PublicAmenity[] };
        setAmenities(response.amenities);
      }
    } catch (error) {
      console.error("Error loading amenities:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Rent Our Amenities for Your Events
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Celebrate at Laguna Hills! Book our clubhouse, pool, or sports
            courts for your special occasions.
          </p>
        </div>
      </div>

      {/* Amenities Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Available Amenities
        </h2>
        {amenities.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No amenities available at this time.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {amenities.map((amenity) => (
              <Card
                key={amenity.amenity_type}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={amenityImages[amenity.amenity_type] || amenity.image}
                    alt={amenity.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle>{amenity.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {amenity.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Up to {amenity.capacity} guests</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link
                    to={`/external-rentals/${amenity.amenity_type}`}
                    className="w-full"
                  >
                    <Button className="w-full">Check Availability</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Browse our amenities and check availability for your preferred
                date
              </li>
              <li>Select your time slot and see the pricing breakdown</li>
              <li>Fill out the booking form with your event details</li>
              <li>Pay via GCash or bank transfer</li>
              <li>Upload proof of payment</li>
              <li>We'll verify and confirm your booking within 24-48 hours</li>
            </ol>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium">Residents get 50% off!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log in to your account to avail the resident discount.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
