import { Link } from "react-router-dom";
import { LogIn, Calendar, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-muted hover:bg-accent transition-colors flex items-center gap-2"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {mounted && (
            <>
              <span className="text-base">{isDark ? "🌙" : "☀️"}</span>
              <span className="hidden sm:inline">
                {isDark ? "Dark" : "Light"}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              Laguna Hills HOA
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Your Community Portal for Residents & Visitors
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Welcome to Laguna Hills Homeowners Association. Residents can manage
            their accounts, payments, and reservations. Visitors can book our
            amenities for special events.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-16">
          {/* Resident Card */}
          <Card className="border-2 hover:border-primary transition-all hover:shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Residents</CardTitle>
              <CardDescription>
                Access your resident portal to manage your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• View announcements and events</li>
                <li>• Book amenities (resident rates)</li>
                <li>• Pay dues and fees</li>
                <li>• Submit service requests</li>
                <li>• Access community documents</li>
              </ul>
              <Link to="/login" className="block">
                <Button className="w-full" size="lg">
                  <LogIn className="w-4 h-4 mr-2" />
                  Resident Login
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Visitor Card */}
          <Card className="border-2 hover:border-primary transition-all hover:shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Visitors</CardTitle>
              <CardDescription>
                Book our amenities for your special events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Clubhouse for parties & meetings</li>
                <li>• Swimming Pool for events</li>
                <li>• Easy online booking</li>
                <li>• Multiple payment options</li>
                <li>• Quick confirmation process</li>
              </ul>
              <Link to="/external-rentals" className="block">
                <Button className="w-full" size="lg" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Amenity
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            About Laguna Hills
          </h2>
          <p className="text-muted-foreground">
            Laguna Hills is a vibrant community dedicated to providing quality
            living for its residents. Our amenities include a clubhouse,
            swimming pool, and sports facilities available for both residents
            and external bookings.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Laguna Hills Homeowners Association
          </p>
          <p className="mt-2">
            Need help?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Contact Us
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
