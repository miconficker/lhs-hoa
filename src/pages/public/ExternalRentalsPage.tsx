import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PublicAmenity } from "@/types";
import { Users, Info, Calendar } from "lucide-react";
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
import { PublicLayout } from "@/components/public/PublicLayout";

const amenityImages: Record<string, string> = {
  clubhouse:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800",
  pool: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800",
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
      <PublicLayout title="External Rentals" showBackButton backTo="/">
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="External Rentals" showBackButton backTo="/">
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4 -mx-4 sm:-mx-8 mt-[-2rem] sm:mt-[-2.5rem]">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Rent Our Amenities for Your Events
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Celebrate at Laguna Hills! Book our clubhouse or pool for your
            special occasions.
          </p>
        </div>
      </div>

      {/* Amenities Grid */}
      <div className="py-12">
        <h2 className="text-2xl font-bold mb-8 text-center text-foreground">
          Available Amenities
        </h2>
        {amenities.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No amenities available at this time.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {amenities.map((amenity) => (
              <Card
                key={amenity.amenity_type}
                className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={amenityImages[amenity.amenity_type] || amenity.image}
                    alt={amenity.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader className="flex-1">
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
                    <Button className="w-full" size="lg">
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Now
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="pb-12">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 max-w-4xl mx-auto">
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
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
