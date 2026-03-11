import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnifiedBookingsTab } from "./UnifiedBookingsTab";
import { TimeBlocksTab } from "./TimeBlocksTab";
import { PricingTab } from "./PricingTab";
import type { AmenityType } from "@/types";
import { useAuth } from "@/hooks/useAuth";

const amenityTypes: AmenityType[] = [
  "clubhouse",
  "pool",
  "basketball-court",
  "tennis-court",
];

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const { tab = "all-bookings" } = useParams<{ tab?: string }>();

  // Security: Ensure only admins can access this page
  if (user?.role !== "admin") {
    return (
      <div className="bg-[hsl(var(--status-error-bg))] border border-[hsl(var(--status-error-fg))] text-[hsl(var(--status-error-fg))] p-4 rounded-lg">
        Access denied. Admin privileges required.
      </div>
    );
  }

  // Map URL param to tab value
  const getTabValue = () => {
    switch (tab) {
      case "all-bookings":
        return "all-bookings";
      case "time-blocks":
        return "time-blocks";
      case "pricing":
        return "pricing";
      default:
        return "all-bookings";
    }
  };

  const [activeTab, setActiveTab] = useState(getTabValue());

  // Sync activeTab with URL param
  useEffect(() => {
    setActiveTab(getTabValue());
  }, [tab]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Reservations Management
        </h1>
        <p className="text-muted-foreground">
          Manage bookings, time blocks, and pricing
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="all-bookings" className="flex items-center gap-2">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            All Bookings
          </TabsTrigger>
          <TabsTrigger value="time-blocks" className="flex items-center gap-2">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Time Blocks
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-bookings" className="space-y-6">
          <UnifiedBookingsTab amenityTypes={amenityTypes} />
        </TabsContent>

        <TabsContent value="time-blocks" className="space-y-6">
          <TimeBlocksTab amenityTypes={amenityTypes} />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <PricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
