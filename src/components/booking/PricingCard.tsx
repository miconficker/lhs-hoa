/**
 * Shared Pricing Card Component
 *
 * Displays pricing breakdown for bookings.
 * Shows resident discount when applicable.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PricingCalculation } from "@/types";

interface PricingCardProps {
  pricing: PricingCalculation;
  isResident: boolean;
}

export function PricingCard({ pricing, isResident }: PricingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Rate */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Base Rate (per hour)</span>
          <span className="font-medium">
            ₱{pricing.baseRate.toLocaleString()}
          </span>
        </div>

        {/* Duration */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{pricing.durationHours} hours</span>
        </div>

        {/* Day Type */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Day Type</span>
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">{pricing.dayType}</span>
            {pricing.isHoliday && (
              <Badge variant="outline" className="text-xs">
                Holiday
              </Badge>
            )}
            {pricing.isWeekend && !pricing.isHoliday && (
              <Badge variant="secondary" className="text-xs">
                Weekend
              </Badge>
            )}
          </div>
        </div>

        {/* Day Multiplier */}
        {pricing.dayMultiplier !== 1 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Day Multiplier</span>
            <span className="font-medium">
              x{pricing.dayMultiplier.toFixed(2)}
            </span>
          </div>
        )}

        {/* Season */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Season</span>
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">
              {pricing.seasonType.replace("_", " ")}
            </span>
            {pricing.isPeakSeason && (
              <Badge variant="outline" className="text-xs">
                Peak Season
              </Badge>
            )}
          </div>
        </div>

        {/* Season Multiplier */}
        {pricing.seasonMultiplier !== 1 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Season Multiplier</span>
            <span className="font-medium">
              x{pricing.seasonMultiplier.toFixed(2)}
            </span>
          </div>
        )}

        {/* Subtotal */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">
            ₱
            {Math.round(
              pricing.baseRate *
                pricing.durationHours *
                pricing.dayMultiplier *
                pricing.seasonMultiplier,
            ).toLocaleString()}
          </span>
        </div>

        {/* Resident Discount */}
        {isResident && pricing.residentDiscount > 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Resident Discount</span>
              <Badge variant="secondary" className="text-xs">
                50% off
              </Badge>
            </div>
            <span className="font-medium text-green-600 dark:text-green-400">
              -₱
              {Math.round(
                pricing.baseRate *
                  pricing.durationHours *
                  pricing.dayMultiplier *
                  pricing.seasonMultiplier *
                  pricing.residentDiscount,
              ).toLocaleString()}
            </span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-4 border-t text-lg">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-primary">
            ₱{pricing.finalAmount.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
