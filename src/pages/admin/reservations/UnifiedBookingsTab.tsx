import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  Filter,
  DollarSign,
  Trash2,
  Users,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPhaseIndicator } from "@/components/public/StatusPhaseIndicator";
import { api } from "@/lib/api";
import { getStatusConfig, getStatusColorClasses } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import type {
  BookingWithCustomer,
  UnifiedBookingStatus,
  AmenityType,
  TimeBlockSlot,
} from "@/types";

interface UnifiedBookingsTabProps {
  amenityTypes: AmenityType[];
}

interface FilterState {
  status: UnifiedBookingStatus | "all";
  amenity: AmenityType | "all";
  slot: TimeBlockSlot | "all";
  customerType: "resident" | "external" | "all";
  search: string;
}

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function UnifiedBookingsTab({ amenityTypes }: UnifiedBookingsTabProps) {
  const [bookings, setBookings] = useState<BookingWithCustomer[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<
    BookingWithCustomer[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithCustomer | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] =
    useState<BookingWithCustomer | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    amenity: "all",
    slot: "all",
    customerType: "all",
    search: "",
  });
  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);

      // Build filter params
      const params: Record<string, string> = {};
      if (filters.status !== "all") params.status = filters.status;
      if (filters.amenity !== "all") params.amenity_type = filters.amenity;
      if (filters.customerType !== "all")
        params.customer_type = filters.customerType;

      const result = await api.bookings.list(params);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBookings(result.data?.bookings || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    if (filters.status !== "all") {
      filtered = filtered.filter((b) => b.booking_status === filters.status);
    }

    if (filters.amenity !== "all") {
      filtered = filtered.filter((b) => b.amenity_type === filters.amenity);
    }

    if (filters.slot !== "all") {
      filtered = filtered.filter((b) => b.slot === filters.slot);
    }

    if (filters.customerType !== "all") {
      filtered = filtered.filter((b) => {
        if (filters.customerType === "resident") return b.user_id !== null;
        if (filters.customerType === "external") return b.customer_id !== null;
        return true;
      });
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((b) => {
        const customerName = `${b.first_name} ${b.last_name}`.toLowerCase();
        const customerEmail = b.email?.toLowerCase() || "";
        const householdAddress = b.household_address?.toLowerCase() || "";
        return (
          customerName.includes(searchLower) ||
          customerEmail.includes(searchLower) ||
          householdAddress.includes(searchLower)
        );
      });
    }

    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setFilteredBookings(filtered);
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const openStatusDialog = (booking: BookingWithCustomer) => {
    setSelectedBooking(booking);
    setRejectionReason(booking.rejection_reason || "");
    setAdminNotes(booking.admin_notes || "");
    const total = booking.amount || 0;
    const paid = booking.amount_paid || 0;
    const remaining = Math.max(0, total - paid);

    // Default for payment review: suggest 50% deposit, but never more than remaining.
    if (booking.booking_status === "payment_review" && total > 0) {
      const deposit = Math.min(remaining, Math.round(total * 0.5 * 100) / 100);
      setPaymentAmount(String(deposit));
    } else if (booking.booking_status === "confirmed" && remaining > 0) {
      setPaymentAmount(String(remaining));
    } else {
      setPaymentAmount("");
    }
    setPaymentMethod(booking.payment_method || "");
    setReceiptNumber(booking.receipt_number || "");
    setIsStatusDialogOpen(true);
  };

  const closeStatusDialog = () => {
    setIsStatusDialogOpen(false);
    setSelectedBooking(null);
    setRejectionReason("");
    setAdminNotes("");
    setPaymentAmount("");
    setPaymentMethod("");
    setReceiptNumber("");
  };

  const getPrimaryAction = (booking: BookingWithCustomer | null): {
    disabled: boolean;
    label: string;
  } => {
    if (!booking) return { disabled: true, label: "Update" };

    if (booking.booking_status === "submitted") {
      const next = (booking.amount ?? 0) > 0 ? "Payment Due" : "Confirmed";
      return { disabled: false, label: `Approve → ${next}` };
    }

    if (booking.booking_status === "payment_review") {
      return { disabled: false, label: "Confirm Payment → Confirmed" };
    }

    if (booking.booking_status === "payment_due") {
      return { disabled: true, label: "Waiting for Proof" };
    }

    if (booking.booking_status === "confirmed") {
      const total = booking.amount || 0;
      const paid = booking.amount_paid || 0;
      const remaining = total - paid;
      if (total > 0 && remaining > 0) {
        return { disabled: false, label: "Record Payment (no status change)" };
      }
      return { disabled: true, label: "Fully Paid" };
    }

    return { disabled: true, label: "No Action" };
  };

  const handleStatusUpdate = async () => {
    if (!selectedBooking) return;

    try {
      setIsProcessing(selectedBooking.id);

      const action =
        selectedBooking.booking_status === "submitted"
          ? "approve"
          : selectedBooking.booking_status === "payment_review"
            ? "confirm_payment"
            : selectedBooking.booking_status === "confirmed"
              ? "record_payment"
            : null;

      if (!action) {
        toast.error("No action available for this status");
        return;
      }

      const paymentAmountNumber = paymentAmount.trim()
        ? Number(paymentAmount)
        : undefined;

      if (
        (action === "confirm_payment" || action === "record_payment") &&
        paymentAmountNumber !== undefined &&
        (Number.isNaN(paymentAmountNumber) || paymentAmountNumber < 0)
      ) {
        toast.error("Payment amount must be a valid number (0 or higher)");
        return;
      }

      const result = await api.bookings.action(selectedBooking.id, {
        action,
        rejection_reason: rejectionReason || undefined,
        admin_notes: adminNotes || undefined,
        ...(action === "confirm_payment" || action === "record_payment"
          ? {
              payment_amount: paymentAmountNumber,
              payment_method: paymentMethod.trim() || undefined,
              receipt_number: receiptNumber.trim() || undefined,
            }
          : {}),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking status updated successfully");
      await loadBookings();
      closeStatusDialog();
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Failed to update booking status");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectBooking = async () => {
    if (!selectedBooking) return;

    try {
      setIsProcessing(selectedBooking.id);

      const result = await api.bookings.action(selectedBooking.id, {
        action: "reject",
        rejection_reason: rejectionReason || "No reason provided",
        admin_notes: adminNotes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking rejected successfully");
      await loadBookings();
      closeStatusDialog();
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast.error("Failed to reject booking");
    } finally {
      setIsProcessing(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      amenity: "all",
      slot: "all",
      customerType: "all",
      search: "",
    });
  };

  const openDeleteDialog = (booking: BookingWithCustomer) => {
    setBookingToDelete(booking);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setBookingToDelete(null);
  };

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) return;

    try {
      setIsProcessing(bookingToDelete.id);
      const result = await api.bookings.delete(bookingToDelete.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking deleted successfully");
      await loadBookings();
      closeDeleteDialog();
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("Failed to delete booking");
    } finally {
      setIsProcessing(null);
    }
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== "all" && v !== "",
  ).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary" />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Bookings</h2>
          <p className="text-muted-foreground">
            Unified view of resident and external bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="mr-2 w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="px-1 ml-2 h-5 min-w-5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 space-y-4 rounded-lg border bg-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="payment_due">Payment Due</SelectItem>
                  <SelectItem value="payment_review">Payment Review</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
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
              <Label htmlFor="type-filter">Customer Type</Label>
              <Select
                value={filters.customerType}
                onValueChange={(v) => updateFilter("customerType", v)}
              >
                <SelectTrigger id="type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-filter">Search</Label>
              <Input
                id="search-filter"
                placeholder="Name, email, address..."
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{bookings.length}</p>
            </div>
            <Calendar className="w-8 h-8 opacity-50 text-primary" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">External</p>
              <p className="text-2xl font-bold">
                {bookings.filter((b) => b.customer_id !== null).length}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold">
                ₱
                {bookings
                  .reduce((sum, b) => sum + (b.amount_paid || 0), 0)
                  .toFixed(0)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold">
                ₱
                {bookings
                  .filter(
                    (b) =>
                      b.booking_status !== "rejected" &&
                      b.booking_status !== "cancelled" &&
                      b.booking_status !== "no_show",
                  )
                  .reduce(
                    (sum, b) => sum + ((b.amount || 0) - (b.amount_paid || 0)),
                    0,
                  )
                  .toFixed(0)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <Calendar className="mb-4 w-12 h-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No bookings found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {activeFilterCount > 0
              ? "Try adjusting your filters to see more results."
              : "When bookings are made, they will appear here."}
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
            <div className="min-w-[1000px]">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Amenity
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-left text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-right text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const statusConfig = getStatusConfig(
                      booking.booking_status,
                    );
                    const statusColors = getStatusColorClasses(
                      booking.booking_status,
                    );
                    const isExternal = booking.customer_id !== null;

                    return (
                      <tr
                        key={booking.id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex gap-2 items-center">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {new Date(booking.date).toLocaleDateString(
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
                                {slotLabels[booking.slot]}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">
                            {amenityLabels[booking.amenity_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              {booking.first_name} {booking.last_name}
                            </p>
                            {booking.email && (
                              <p className="text-xs text-muted-foreground">
                                {booking.email}
                              </p>
                            )}
                            {booking.household_address && (
                              <p className="text-xs text-muted-foreground">
                                {booking.household_address}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isExternal ? "outline" : "secondary"}>
                            {isExternal ? "External" : "Resident"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {(booking.amount || 0) > 0 ? (
                              <>
                                <p className="text-sm font-medium">
                                  ₱{(booking.amount || 0).toFixed(0)}
                                </p>
                                {booking.amount_paid &&
                                  booking.amount_paid > 0 && (
                                    <>
                                      <p className="text-xs text-muted-foreground">
                                        Paid: ₱{booking.amount_paid.toFixed(0)}
                                      </p>
                                      {(booking.amount || 0) -
                                        booking.amount_paid >
                                        0 && (
                                        <p className="text-xs text-destructive">
                                          Balance: ₱
                                          {(
                                            (booking.amount || 0) -
                                            booking.amount_paid
                                          ).toFixed(0)}
                                        </p>
                                      )}
                                    </>
                                  )}
                                {booking.payment_status && (
                                  <Badge
                                    variant={
                                      booking.payment_status === "paid"
                                        ? "default"
                                        : booking.payment_status === "partial"
                                          ? "outline"
                                          : "secondary"
                                    }
                                    className="mt-1"
                                  >
                                    {booking.payment_status.toUpperCase()}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-sm font-medium text-green-600">
                                Free
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusConfig.variant}
                            className={cn(
                              "gap-1",
                              statusColors.border,
                              statusColors.bg,
                              statusColors.text,
                            )}
                          >
                            <statusConfig.icon className="w-3 h-3" />
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end items-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openStatusDialog(booking)}
                              title="Update status"
                            >
                              {booking.booking_status === "submitted" ||
                              booking.booking_status === "payment_review" ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDeleteDialog(booking)}
                              title="Delete booking"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Booking Status</DialogTitle>
            <DialogDescription>
              {selectedBooking && (
                <>
                  Update status for {selectedBooking.first_name}{" "}
                  {selectedBooking.last_name} -{" "}
                  {amenityLabels[selectedBooking.amenity_type]} on{" "}
                  {new Date(selectedBooking.date).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Next: {getPrimaryAction(selectedBooking).label}
                </div>
                <StatusPhaseIndicator
                  status={selectedBooking.booking_status as any}
                />
              </div>

              {/* Current Status */}
              <div className="p-3 space-y-1 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-medium">{selectedBooking.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Reference Number:
                  </span>
                  <span className="font-medium">
                    {selectedBooking.reference_number || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Status:</span>
                  <span className="font-medium">
                    {getStatusConfig(selectedBooking.booking_status).label}
                  </span>
                </div>
                {selectedBooking.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{selectedBooking.email}</span>
                  </div>
                )}
                {selectedBooking.phone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{selectedBooking.phone}</span>
                  </div>
                )}
                {selectedBooking.proof_of_payment_url && (
                  <div className="flex items-center justify-between gap-3 text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                      Payment Proof:
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(`/api/bookings/${selectedBooking.id}/proof`, "_blank")
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amenity:</span>
                  <span className="font-medium">
                    {amenityLabels[selectedBooking.amenity_type]}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {new Date(selectedBooking.date).toLocaleDateString()} -{" "}
                    {slotLabels[selectedBooking.slot]}
                  </span>
                </div>
                {(selectedBooking.amount || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">
                        ₱{(selectedBooking.amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="font-medium">
                        ₱{(selectedBooking.amount_paid || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining:</span>
                      <span className="font-medium">
                        ₱
                        {Math.max(
                          0,
                          (selectedBooking.amount || 0) -
                            (selectedBooking.amount_paid || 0),
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {(selectedBooking.booking_status === "payment_review" ||
                selectedBooking.booking_status === "confirmed") &&
                (selectedBooking.amount || 0) > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="payment_amount">
                      Payment Received Now (₱)
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="payment_amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="e.g., 2500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const total = selectedBooking.amount || 0;
                          const paid = selectedBooking.amount_paid || 0;
                          const remaining = Math.max(0, total - paid);
                          const deposit = Math.min(
                            remaining,
                            Math.round(total * 0.5 * 100) / 100,
                          );
                          setPaymentAmount(String(deposit));
                        }}
                      >
                        50% Deposit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const total = selectedBooking.amount || 0;
                          const paid = selectedBooking.amount_paid || 0;
                          const remaining = Math.max(0, total - paid);
                          setPaymentAmount(String(remaining));
                        }}
                      >
                        Remaining
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="payment_method">Payment Method</Label>
                        <Input
                          id="payment_method"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          placeholder="e.g., GCash"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="receipt_number">Receipt #</Label>
                        <Input
                          id="receipt_number"
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="optional"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: Confirming payment can be a deposit. You can record
                      the remaining balance later from the Confirmed status.
                    </p>
                  </div>
                )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="admin_notes">Admin Notes</Label>
                <Textarea
                  id="admin_notes"
                  placeholder="Add notes about this booking..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Rejection Reason (only show if rejecting) */}
              {(selectedBooking.booking_status === "submitted" ||
                selectedBooking.booking_status === "payment_due" ||
                selectedBooking.booking_status === "payment_review") && (
                <div className="space-y-2">
                  <Label htmlFor="rejection_reason">
                    Rejection Reason (if rejecting)
                  </Label>
                  <Textarea
                    id="rejection_reason"
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeStatusDialog}
              disabled={isProcessing === selectedBooking?.id}
            >
              Cancel
            </Button>
            {(selectedBooking?.booking_status === "submitted" ||
              selectedBooking?.booking_status === "payment_due" ||
              selectedBooking?.booking_status === "payment_review") && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRejectBooking}
                disabled={isProcessing === selectedBooking?.id}
              >
                {isProcessing === selectedBooking?.id
                  ? "Rejecting..."
                  : "Reject"}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleStatusUpdate}
              disabled={
                isProcessing === selectedBooking?.id ||
                getPrimaryAction(selectedBooking).disabled
              }
            >
              {isProcessing === selectedBooking?.id
                ? "Updating..."
                : getPrimaryAction(selectedBooking).label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Booking?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this booking? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {bookingToDelete && (
            <div className="p-3 space-y-1 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(bookingToDelete.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amenity:</span>
                <span className="font-medium">
                  {amenityLabels[bookingToDelete.amenity_type]}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slot:</span>
                <span className="font-medium">
                  {slotLabels[bookingToDelete.slot]}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">
                  {bookingToDelete.first_name} {bookingToDelete.last_name}
                  {bookingToDelete.household_address &&
                    ` (${bookingToDelete.household_address})`}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isProcessing === bookingToDelete?.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteBooking}
              disabled={isProcessing === bookingToDelete?.id}
            >
              {isProcessing === bookingToDelete?.id ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
