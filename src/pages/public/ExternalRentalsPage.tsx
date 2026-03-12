import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PublicAmenity } from "@/types";
import { Users, Info, Home, Moon, Sun } from "lucide-react";
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
import { useTheme } from "next-themes";

const amenityImages: Record<string, string> = {
  clubhouse:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800",
  pool: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800",
};

export function ExternalRentalsPage() {
  const { theme, setTheme } = useTheme();
  const [amenities, setAmenities] = useState<PublicAmenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadAmenities();
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header with theme toggle and home link */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link to="/">
          <Button variant="outline" size="icon" title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
        </Link>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-10 h-10 rounded-lg border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {mounted && (
            <>
              <Sun className="h-[1.3rem] w-[1.3rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
              <Moon className="absolute h-[1.3rem] w-[1.3rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
            </>
          )}
        </button>
      </div>

      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
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
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center text-foreground">
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
        <Card className="bg-blue-50 dark:bg-gray-800 border-blue-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Info className="w-5 h-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-800 dark:text-gray-200">
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
    </div>
  );
}
