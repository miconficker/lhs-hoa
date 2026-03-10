import { PricingSettings } from "@/components/admin/PricingSettings";

/**
 * Pricing/Payments Tab
 *
 * This tab allows administrators to configure amenity pricing settings.
 * Residents receive discounted rates compared to external rentals.
 *
 * Features:
 * - Configure resident vs external pricing for all amenities
 * - Set AM, PM, and FULL_DAY rates
 * - Visual discount percentage display
 */
export function PricingTab() {
  return <PricingSettings />;
}
