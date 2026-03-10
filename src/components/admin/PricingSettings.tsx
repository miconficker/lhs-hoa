import { useState, useEffect } from "react";
import { DollarSign, Save, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { AmenityType, ReservationSlot } from "@/types";

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<ReservationSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

interface PricingConfig {
  amenity: AmenityType;
  slot: ReservationSlot;
  residentRate: number;
  externalRate: number;
}

export function PricingSettings() {
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      setLoading(true);
      const hoa_token = localStorage.getItem("hoa_token");

      // Get pricing from system settings
      const response = await fetch("/api/admin/settings/pricing", {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load pricing settings");
      }

      const data = await response.json();
      setPricing(data.pricing || []);
    } catch (error) {
      console.error("Error loading pricing:", error);
      toast.error("Failed to load pricing settings");
    } finally {
      setLoading(false);
    }
  };

  const updatePricing = (
    amenity: AmenityType,
    slot: ReservationSlot,
    field: "residentRate" | "externalRate",
    value: number,
  ) => {
    setPricing((prev) =>
      prev.map((p) =>
        p.amenity === amenity && p.slot === slot ? { ...p, [field]: value } : p,
      ),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch("/api/admin/settings/pricing", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hoa_token}`,
        },
        body: JSON.stringify({ pricing }),
      });

      if (!response.ok) {
        throw new Error("Failed to save pricing settings");
      }

      toast.success("Pricing settings saved successfully");
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error("Failed to save pricing settings");
    } finally {
      setSaving(false);
    }
  };

  const calculateDiscount = (residentRate: number, externalRate: number) => {
    if (externalRate === 0) return 0;
    return Math.round(((externalRate - residentRate) / externalRate) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const amenityTypes: AmenityType[] = [
    "clubhouse",
    "pool",
    "basketball-court",
    "tennis-court",
  ];
  const slots: ReservationSlot[] = ["AM", "PM", "FULL_DAY"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Amenity Pricing</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPricing} disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Reset
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">Resident vs External Pricing</p>
            <p className="mt-1">
              Homeowners receive discounted rates on amenity reservations
              compared to external bookings. External rates apply to
              non-resident rentals.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <form onSubmit={handleSave} className="space-y-6">
        {amenityTypes.map((amenity) => (
          <div
            key={amenity}
            className="rounded-lg border bg-card p-4 space-y-4"
          >
            <h4 className="font-semibold">{amenityLabels[amenity]}</h4>

            {slots.map((slot) => {
              const pricingItem = pricing.find(
                (p) => p.amenity === amenity && p.slot === slot,
              );
              const residentRate = pricingItem?.residentRate || 0;
              const externalRate = pricingItem?.externalRate || 0;
              const discount = calculateDiscount(residentRate, externalRate);

              return (
                <div
                  key={slot}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start p-3 rounded-lg bg-muted/50"
                >
                  <div className="md:col-span-1">
                    <p className="text-sm font-medium">{slotLabels[slot]}</p>
                  </div>

                  <div>
                    <Label
                      htmlFor={`${amenity}-${slot}-resident`}
                      className="text-xs"
                    >
                      Resident Rate (₱)
                    </Label>
                    <Input
                      id={`${amenity}-${slot}-resident`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={residentRate}
                      onChange={(e) =>
                        updatePricing(
                          amenity,
                          slot,
                          "residentRate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor={`${amenity}-${slot}-external`}
                      className="text-xs"
                    >
                      External Rate (₱)
                    </Label>
                    <Input
                      id={`${amenity}-${slot}-external`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={externalRate}
                      onChange={(e) =>
                        updatePricing(
                          amenity,
                          slot,
                          "externalRate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8"
                    />
                  </div>

                  <div className="flex items-center">
                    {discount > 0 ? (
                      <Badge variant="secondary">
                        {discount}% resident discount
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No discount
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Actions */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className={`w-4 h-4 mr-2 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Pricing"}
          </Button>
        </div>
      </form>
    </div>
  );
}
