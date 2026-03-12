import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SuccessPage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    // Auto-redirect to confirmation page after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = `/external-rentals/confirmation/${id}`;
    }, 3000);

    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-12 pb-8 text-center">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">
            Booking Request Submitted!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your booking request has been received. Please upload your proof of
            payment to proceed with confirmation.
          </p>

          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">Booking Reference</p>
            <p className="text-lg font-mono font-bold">
              {id?.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <Link to={`/external-rentals/confirmation/${id}`}>
            <Button className="w-full">
              View Booking Status
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            Redirecting automatically...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
