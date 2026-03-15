import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AdminBookingForm } from "@/components/admin/AdminBookingForm";
import type { AdminBookingRequest } from "@/types";

export function CreateBookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [success, setSuccess] = useState(false);

  if (user?.role !== "admin" && user?.role !== "staff") {
    return (
      <div className="flex items-center justify-center h-96">
        <Callout variant="error" title="Access Denied">
          You don't have permission to access this page.
        </Callout>
      </div>
    );
  }

  const handleSubmit = async (data: AdminBookingRequest) => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await api.admin.createBooking(data);
      if (response.error) {
        setErrorMessage(response.error);
      } else if (response.data) {
        setSuccess(true);
        // Navigate to bookings page after 2 seconds
        setTimeout(() => {
          navigate("/admin/reservations/bookings");
        }, 2000);
      }
    } catch (err) {
      setErrorMessage("Failed to create booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/reservations/bookings");
  };

  if (success) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold">Booking Created Successfully!</h2>
          <p className="text-muted-foreground">
            Redirecting to bookings page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {errorMessage && <Callout variant="error">{errorMessage}</Callout>}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Booking</h1>
          <p className="text-muted-foreground">
            Create a new booking on behalf of a resident or guest
          </p>
        </div>
      </div>

      {/* Form */}
      {isSubmitting ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <AdminBookingForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
