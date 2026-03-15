import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Callout } from "@/components/ui/callout";
import {
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { SummaryCard } from "@/components/admin/analytics/SummaryCard";
import { RevenueChart } from "@/components/admin/analytics/RevenueChart";
import { BookingsByStatusChart } from "@/components/admin/analytics/BookingsByStatusChart";
import { CustomerTypeChart } from "@/components/admin/analytics/CustomerTypeChart";
import { PopularAmenitiesChart } from "@/components/admin/analytics/PopularAmenitiesChart";
import { PopularSlotsChart } from "@/components/admin/analytics/PopularSlotsChart";
import { Button } from "@/components/ui/button";
import type { BookingAnalyticsResponse } from "@/types";

export function BookingAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BookingAnalyticsResponse | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "this_month">(
    "30d",
  );

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    const response = await api.admin.getBookingAnalytics({ period });
    if (response.error) {
      setError(response.error);
    } else if (response.data) {
      setData(response.data);
    }
    setLoading(false);
  };

  if (user?.role !== "admin" && user?.role !== "staff") {
    return (
      <div className="flex items-center justify-center h-96">
        <Callout variant="error" title="Access Denied">
          You don't have permission to access this page.
        </Callout>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Callout variant="error" title="Error loading analytics">
          {error || "Failed to load analytics data"}
        </Callout>
      </div>
    );
  }

  const {
    summary,
    revenue_by_day,
    bookings_by_status,
    customer_type_breakdown,
    revenue_by_amenity,
    popular_slots,
    top_customers,
  } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking Analytics</h1>
          <p className="text-muted-foreground">Revenue and booking insights</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d", "this_month"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === "7d"
                ? "7 Days"
                : p === "30d"
                  ? "30 Days"
                  : p === "90d"
                    ? "90 Days"
                    : "This Month"}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Revenue"
          value={summary.total_revenue}
          format="currency"
          icon={DollarSign}
          trend="up"
        />
        <SummaryCard
          title="Total Bookings"
          value={summary.total_bookings}
          icon={Calendar}
        />
        <SummaryCard
          title="Confirmed"
          value={summary.confirmed_bookings}
          icon={CheckCircle}
        />
        <SummaryCard
          title="Unique Customers"
          value={summary.unique_customers}
          icon={Users}
        />
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={revenue_by_day} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BookingsByStatusChart data={bookings_by_status} />
        <CustomerTypeChart data={customer_type_breakdown} />
      </div>

      {/* Popular Amenities and Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PopularAmenitiesChart data={revenue_by_amenity} />
        <PopularSlotsChart data={popular_slots} />
      </div>

      {/* Top Customers */}
      {top_customers.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Customers
            </h3>
          </div>
          <div className="p-6 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Bookings</th>
                    <th className="text-right p-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {top_customers.map((customer, idx) => (
                    <tr key={idx} className="border-b hover:bg-accent/50">
                      <td className="p-2 font-medium">
                        {customer.customer_name}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            customer.customer_type === "Resident"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {customer.customer_type}
                        </span>
                      </td>
                      <td className="p-2 text-right">{customer.bookings}</td>
                      <td className="p-2 text-right font-medium">
                        ₱{customer.total_revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
