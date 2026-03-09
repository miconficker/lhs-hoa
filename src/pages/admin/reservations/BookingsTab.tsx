import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Home, Check, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ReservationWithHousehold,
  ReservationStatus,
  AmenityType,
  ReservationSlot,
} from "@/types";

interface BookingsTabProps {
  amenityTypes: AmenityType[];
}

interface FilterState {
  status: ReservationStatus | "all";
  amenity: AmenityType | "all";
  slot: ReservationSlot | "all";
  search: string;
}

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const statusLabels: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const statusBadgeVariant: Record<
  ReservationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "outline",
};

const slotLabels: Record<ReservationSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function BookingsTab({ amenityTypes }: BookingsTabProps) {
  const [reservations, setReservations] = useState<ReservationWithHousehold[]>(
    [],
  );
  const [filteredReservations, setFilteredReservations] = useState<
    ReservationWithHousehold[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    amenity: "all",
    slot: "all",
    search: "",
  });

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reservations, filters]);

  const loadReservations = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // Fetch all reservations
      const response = await fetch("/api/admin/reservations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load reservations");
      }

      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast.error("Failed to load reservations");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reservations];

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((r) => r.status === filters.status);
    }

    // Amenity filter
    if (filters.amenity !== "all") {
      filtered = filtered.filter((r) => r.amenity_type === filters.amenity);
    }

    // Slot filter
    if (filters.slot !== "all") {
      filtered = filtered.filter((r) => r.slot === filters.slot);
    }

    // Search filter (household address or purpose)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.household_address?.toLowerCase().includes(searchLower) ||
          r.purpose?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by date (newest first)
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setFilteredReservations(filtered);
  };

  const updateReservationStatus = async (
    reservationId: string,
    newStatus: ReservationStatus,
  ) => {
    try {
      setIsProcessing(reservationId);
      const token = localStorage.getItem("token");

      const response = await fetch(
        `/api/admin/reservations/${reservationId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update reservation");
      }

      // Update local state
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: newStatus } : r,
        ),
      );

      toast.success(
        `Reservation ${newStatus === "confirmed" ? "approved" : "declined"} successfully`,
      );
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("Failed to update reservation");
    } finally {
      setIsProcessing(null);
    }
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      amenity: "all",
      slot: "all",
      search: "",
    });
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== "all" && v !== "",
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading reservations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Resident Bookings
          </h2>
          <p className="text-muted-foreground">
            Manage and approve amenity reservation requests
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => updateFilter("status", v)}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amenity-filter">Amenity</Label>
              <Select
                value={filters.amenity}
                onValueChange={(v) => updateFilter("amenity", v)}
              >
                <SelectTrigger id="amenity-filter">
                  <SelectValue placeholder="All amenities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Amenities</SelectItem>
                  {amenityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {amenityLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-filter">Time Slot</Label>
              <Select
                value={filters.slot}
                onValueChange={(v) => updateFilter("slot", v)}
              >
                <SelectTrigger id="slot-filter">
                  <SelectValue placeholder="All slots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Slots</SelectItem>
                  <SelectItem value="AM">Morning</SelectItem>
                  <SelectItem value="PM">Afternoon</SelectItem>
                  <SelectItem value="FULL_DAY">Full Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-filter">Search</Label>
              <Input
                id="search-filter"
                placeholder="Address or purpose..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {reservations.filter((r) => r.status === "pending").length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold">
                {reservations.filter((r) => r.status === "confirmed").length}
              </p>
            </div>
            <Check className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold">
                {reservations.filter((r) => r.status === "cancelled").length}
              </p>
            </div>
            <X className="h-8 w-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Reservations List */}
      {filteredReservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No reservations found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {activeFilterCount > 0
              ? "Try adjusting your filters to see more results."
              : "When residents make reservations, they will appear here."}
          </p>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-4"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Amenity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Resident
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Purpose
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(reservation.date).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slotLabels[reservation.slot]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {amenityLabels[reservation.amenity_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {reservation.household_address || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {reservation.purpose || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant[reservation.status]}>
                        {statusLabels[reservation.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {reservation.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateReservationStatus(
                                  reservation.id,
                                  "confirmed",
                                )
                              }
                              disabled={isProcessing === reservation.id}
                              aria-label="Approve reservation"
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateReservationStatus(
                                  reservation.id,
                                  "cancelled",
                                )
                              }
                              disabled={isProcessing === reservation.id}
                              aria-label="Decline reservation"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
