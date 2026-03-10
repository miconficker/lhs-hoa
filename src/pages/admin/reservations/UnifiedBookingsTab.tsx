import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Home,
  Check,
  X,
  Filter,
  Receipt,
  DollarSign,
  Trash2,
  Users,
  Award,
  Plus,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  UnifiedReservation,
  ReservationStatus,
  AmenityType,
  ReservationSlot,
  ReservationPaymentStatus,
  CustomerType,
} from "@/types";

interface UnifiedBookingsTabProps {
  amenityTypes: AmenityType[];
}

interface FilterState {
  status: ReservationStatus | "all";
  amenity: AmenityType | "all";
  slot: ReservationSlot | "all";
  customerType: CustomerType | "all";
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

const paymentStatusLabels: Record<ReservationPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

const paymentStatusBadgeVariant: Record<
  ReservationPaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  unpaid: "secondary",
  partial: "outline",
  paid: "default",
  overdue: "destructive",
};

const customerTypeLabels: Record<CustomerType, string> = {
  resident: "Resident",
  external: "External",
  board_free: "Board (Free)",
  board_paid: "Board (Paid)",
};

const customerTypeBadgeVariant: Record<
  CustomerType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  resident: "secondary",
  external: "outline",
  board_free: "default",
  board_paid: "destructive",
};

interface PaymentFormData {
  amount: string;
  payment_method: string;
  receipt_number: string;
}

const emptyPaymentForm: PaymentFormData = {
  amount: "",
  payment_method: "",
  receipt_number: "",
};

interface BookingFormData {
  booking_type: "resident" | "board_member" | "external";
  household_id?: string;
  user_id?: string;
  renter_name?: string;
  renter_contact?: string;
  amenity_type: AmenityType | "";
  date: string;
  slot: ReservationSlot | "";
  amount?: string;
  purpose?: string;
  notes?: string;
}

const emptyBookingForm: BookingFormData = {
  booking_type: "resident",
  amenity_type: "",
  date: "",
  slot: "",
  amount: "",
};

export function UnifiedBookingsTab({ amenityTypes }: UnifiedBookingsTabProps) {
  const [reservations, setReservations] = useState<UnifiedReservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<
    UnifiedReservation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentReservation, setPaymentReservation] =
    useState<UnifiedReservation | null>(null);
  const [paymentForm, setPaymentForm] =
    useState<PaymentFormData>(emptyPaymentForm);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] =
    useState<UnifiedReservation | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    amenity: "all",
    slot: "all",
    customerType: "all",
    search: "",
  });
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [bookingForm, setBookingForm] =
    useState<BookingFormData>(emptyBookingForm);
  const [households, setHouseholds] = useState<any[]>([]);
  const [boardMembers, setBoardMembers] = useState<any[]>([]);
  // Fuzzy search states
  const [householdSearch, setHouseholdSearch] = useState("");
  const [householdSuggestions, setHouseholdSuggestions] = useState<any[]>([]);
  const [boardMemberSearch, setBoardMemberSearch] = useState("");
  const [boardMemberSuggestions, setBoardMemberSuggestions] = useState<any[]>(
    [],
  );
  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reservations, filters]);

  // Fuzzy search for households
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (householdSearch.length >= 1) {
        const filtered = households.filter(
          (h) =>
            h.address?.toLowerCase().includes(householdSearch.toLowerCase()) ||
            h.lot_label?.toLowerCase().includes(householdSearch.toLowerCase()),
        );
        setHouseholdSuggestions(filtered.slice(0, 50));
      } else {
        setHouseholdSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [householdSearch, households]);

  // Fuzzy search for board members
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (boardMemberSearch.length >= 1) {
        const filtered = boardMembers.filter(
          (bm) =>
            bm.user_email
              ?.toLowerCase()
              .includes(boardMemberSearch.toLowerCase()) ||
            bm.user_name
              ?.toLowerCase()
              .includes(boardMemberSearch.toLowerCase()),
        );
        setBoardMemberSuggestions(filtered.slice(0, 50));
      } else {
        setBoardMemberSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [boardMemberSearch, boardMembers]);

  const loadReservations = async () => {
    try {
      setIsLoading(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch("/api/admin/reservations/unified", {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
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

    if (filters.status !== "all") {
      filtered = filtered.filter((r) => r.status === filters.status);
    }

    if (filters.amenity !== "all") {
      filtered = filtered.filter((r) => r.amenity_type === filters.amenity);
    }

    if (filters.slot !== "all") {
      filtered = filtered.filter((r) => r.slot === filters.slot);
    }

    if (filters.customerType !== "all") {
      filtered = filtered.filter(
        (r) => r.customer_type === filters.customerType,
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.household_address?.toLowerCase().includes(searchLower) ||
          r.renter_name?.toLowerCase().includes(searchLower) ||
          r.user_email?.toLowerCase().includes(searchLower) ||
          r.user_name?.toLowerCase().includes(searchLower),
      );
    }

    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setFilteredReservations(filtered);
  };

  const updateReservationStatus = async (
    reservationId: string,
    newStatus: ReservationStatus,
  ) => {
    // Only resident bookings can have status changed
    const reservation = reservations.find((r) => r.id === reservationId);
    if (!reservation || reservation.customer_type === "external") {
      return;
    }

    try {
      setIsProcessing(reservationId);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(
        `/api/admin/reservations/${reservationId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hoa_token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update reservation");
      }

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

  const openPaymentDialog = (reservation: UnifiedReservation) => {
    setPaymentReservation(reservation);
    const remainingBalance =
      (reservation.amount || 0) - (reservation.amount_paid || 0);
    setPaymentForm({
      amount: remainingBalance > 0 ? remainingBalance.toString() : "",
      payment_method: "",
      receipt_number: "",
    });
    setIsPaymentDialogOpen(true);
  };

  const closePaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    setPaymentReservation(null);
    setPaymentForm(emptyPaymentForm);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentReservation) return;

    if (!paymentForm.amount || isNaN(parseFloat(paymentForm.amount))) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      setIsProcessing(paymentReservation.id);
      const hoa_token = localStorage.getItem("hoa_token");

      const isExternal = paymentReservation.customer_type === "external";
      const url = isExternal
        ? `/api/admin/external-rentals/${paymentReservation.id}/payment`
        : `/api/admin/reservations/${paymentReservation.id}/payment`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hoa_token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method || undefined,
          receipt_number: paymentForm.receipt_number || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record payment");
      }

      await loadReservations();
      closePaymentDialog();
      toast.success("Payment recorded successfully");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
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

  const openDeleteDialog = (reservation: UnifiedReservation) => {
    setReservationToDelete(reservation);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setReservationToDelete(null);
  };

  const handleDeleteReservation = async () => {
    if (!reservationToDelete) return;

    try {
      setIsProcessing(reservationToDelete.id);
      const hoa_token = localStorage.getItem("hoa_token");

      const isExternal = reservationToDelete.customer_type === "external";
      const url = isExternal
        ? `/api/admin/external-rentals/${reservationToDelete.id}`
        : `/api/admin/reservations/${reservationToDelete.id}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete reservation");
      }

      await loadReservations();
      closeDeleteDialog();
      toast.success("Reservation deleted successfully");
    } catch (error) {
      console.error("Error deleting reservation:", error);
      toast.error("Failed to delete reservation");
    } finally {
      setIsProcessing(null);
    }
  };

  const openBookingDialog = async () => {
    // Load households and board members for the dropdowns
    try {
      const hoa_token = localStorage.getItem("hoa_token");

      const [householdsRes, boardMembersRes] = await Promise.all([
        fetch("/api/admin/households", {
          headers: { Authorization: `Bearer ${hoa_token}` },
        }),
        fetch("/api/admin/board-members", {
          headers: { Authorization: `Bearer ${hoa_token}` },
        }),
      ]);

      if (householdsRes.ok) {
        const householdsData = await householdsRes.json();
        setHouseholds(householdsData.households || []);
      }
      if (boardMembersRes.ok) {
        const boardMembersData = await boardMembersRes.json();
        // Filter to only active board members (not resigned, term not expired)
        const activeBoardMembers = (
          boardMembersData.board_members || []
        ).filter(
          (bm: any) => !bm.resigned_at && new Date(bm.term_end) >= new Date(),
        );
        setBoardMembers(activeBoardMembers);
      }
    } catch (error) {
      console.error("Error loading booking data:", error);
    }

    setBookingForm(emptyBookingForm);
    setHouseholdSearch("");
    setHouseholdSuggestions([]);
    setBoardMemberSearch("");
    setBoardMemberSuggestions([]);
    setIsBookingDialogOpen(true);
  };

  const closeBookingDialog = () => {
    setIsBookingDialogOpen(false);
    setBookingForm(emptyBookingForm);
    setHouseholdSearch("");
    setHouseholdSuggestions([]);
    setBoardMemberSearch("");
    setBoardMemberSuggestions([]);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { booking_type, amenity_type, date, slot } = bookingForm;

    // Validation
    if (!amenity_type || !date || !slot) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (booking_type === "resident" && !bookingForm.household_id) {
      toast.error("Please select a household");
      return;
    }

    if (booking_type === "board_member" && !bookingForm.user_id) {
      toast.error("Please select a board member");
      return;
    }

    if (booking_type === "external" && !bookingForm.renter_name?.trim()) {
      toast.error("Please enter renter name");
      return;
    }

    try {
      setIsProcessing("booking");
      const hoa_token = localStorage.getItem("hoa_token");

      if (booking_type === "external") {
        // Create external rental
        const response = await fetch("/api/admin/external-rentals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hoa_token}`,
          },
          body: JSON.stringify({
            amenity_type,
            date,
            slot,
            renter_name: bookingForm.renter_name?.trim(),
            renter_contact: bookingForm.renter_contact?.trim() || undefined,
            amount: bookingForm.amount ? parseFloat(bookingForm.amount) : 0,
            notes: bookingForm.notes?.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create external rental");
        }
      } else {
        // Create reservation (resident or board member)
        const household_id =
          booking_type === "resident"
            ? bookingForm.household_id
            : await getHouseholdForUser(bookingForm.user_id!);

        if (!household_id) {
          toast.error("Could not find household for this booking");
          return;
        }

        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hoa_token}`,
          },
          body: JSON.stringify({
            household_id,
            amenity_type,
            date,
            slot,
            purpose: bookingForm.purpose?.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create reservation");
        }
      }

      await loadReservations();
      closeBookingDialog();
      toast.success("Booking created successfully");
    } catch (error: any) {
      console.error("Error creating booking:", error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setIsProcessing(null);
    }
  };

  const getHouseholdForUser = async (
    userId: string,
  ): Promise<string | null> => {
    try {
      const hoa_token = localStorage.getItem("hoa_token");
      const response = await fetch(`/api/admin/households?owner_id=${userId}`, {
        headers: { Authorization: `Bearer ${hoa_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const household = data.households?.[0];
        return household?.id || null;
      }
      return null;
    } catch {
      return null;
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
            Unified view of resident, external, and board member bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openBookingDialog()}>
            <Plus className="mr-2 w-4 h-4" />
            Add Booking
          </Button>
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
                  <SelectItem value="board_free">Board (Free)</SelectItem>
                  <SelectItem value="board_paid">Board (Paid)</SelectItem>
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
              <p className="text-2xl font-bold">{reservations.length}</p>
            </div>
            <Calendar className="w-8 h-8 opacity-50 text-primary" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Board Free</p>
              <p className="text-2xl font-bold">
                {
                  reservations.filter((r) => r.customer_type === "board_free")
                    .length
                }
              </p>
            </div>
            <Award className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold">
                ₱
                {reservations
                  .reduce((sum, r) => sum + (r.amount_paid || 0), 0)
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
                {reservations
                  .reduce(
                    (sum, r) => sum + ((r.amount || 0) - (r.amount_paid || 0)),
                    0,
                  )
                  .toFixed(0)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Reservations List */}
      {filteredReservations.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <Calendar className="mb-4 w-12 h-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No reservations found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {activeFilterCount > 0
              ? "Try adjusting your filters to see more results."
              : "When reservations are made, they will appear here."}
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
                {filteredReservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
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
                      {reservation.customer_type === "external" ? (
                        <div>
                          <p className="text-sm font-medium">
                            {reservation.renter_name}
                          </p>
                          {reservation.renter_contact && (
                            <p className="text-xs text-muted-foreground">
                              {reservation.renter_contact}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center">
                          {reservation.customer_type.includes("board") ? (
                            <Users className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Home className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {reservation.user_name ||
                                reservation.household_address ||
                                "Unknown"}
                            </p>
                            {reservation.user_email && (
                              <p className="text-xs text-muted-foreground">
                                {reservation.user_email}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          customerTypeBadgeVariant[reservation.customer_type]
                        }
                      >
                        {customerTypeLabels[reservation.customer_type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {(reservation.amount || 0) > 0 ? (
                          <>
                            <p className="text-sm font-medium">
                              ₱{(reservation.amount || 0).toFixed(0)}
                            </p>
                            {reservation.amount_paid &&
                              reservation.amount_paid > 0 && (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    Paid: ₱{reservation.amount_paid.toFixed(0)}
                                  </p>
                                  {(reservation.amount || 0) -
                                    reservation.amount_paid >
                                    0 && (
                                    <p className="text-xs text-destructive">
                                      Balance: ₱
                                      {(
                                        (reservation.amount || 0) -
                                        reservation.amount_paid
                                      ).toFixed(0)}
                                    </p>
                                  )}
                                </>
                              )}
                            {reservation.payment_status && (
                              <Badge
                                variant={
                                  paymentStatusBadgeVariant[
                                    reservation.payment_status
                                  ]
                                }
                                className="mt-1"
                              >
                                {
                                  paymentStatusLabels[
                                    reservation.payment_status
                                  ]
                                }
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
                      <Badge variant={statusBadgeVariant[reservation.status]}>
                        {statusLabels[reservation.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end items-center">
                        {(reservation.amount || 0) > 0 &&
                          (!reservation.payment_status ||
                            reservation.payment_status === "unpaid" ||
                            reservation.payment_status === "partial") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPaymentDialog(reservation)}
                              title="Record payment"
                            >
                              <Receipt className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                        {reservation.customer_type !== "external" &&
                          reservation.status === "pending" && (
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
                                <Check className="w-4 h-4 text-green-500" />
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
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        {reservation.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(reservation)}
                            title="Delete reservation"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
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

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentReservation && (
                <>
                  Record payment for{" "}
                  {paymentReservation.customer_type === "external"
                    ? paymentReservation.renter_name
                    : paymentReservation.user_name ||
                      paymentReservation.household_address}{" "}
                  - {amenityLabels[paymentReservation.amenity_type]} on{" "}
                  {new Date(paymentReservation.date).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit}>
            <div className="py-4 space-y-4">
              {paymentReservation && (
                <div className="p-3 space-y-1 rounded-lg bg-muted/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">
                      ₱{(paymentReservation.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Previously Paid:
                    </span>
                    <span className="font-medium">
                      ₱{(paymentReservation.amount_paid || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Balance Due:</span>
                    <span className="text-destructive">
                      ₱
                      {(
                        (paymentReservation.amount || 0) -
                        (paymentReservation.amount_paid || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Payment Amount (₱) *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Input
                  id="payment_method"
                  placeholder="e.g., Cash, GCash, Bank Transfer"
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_number">Receipt Number</Label>
                <Input
                  id="receipt_number"
                  placeholder="Official receipt number..."
                  value={paymentForm.receipt_number}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      receipt_number: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closePaymentDialog}
                disabled={isProcessing === paymentReservation?.id}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing === paymentReservation?.id}
              >
                {isProcessing === paymentReservation?.id
                  ? "Recording..."
                  : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Booking</DialogTitle>
            <DialogDescription>
              Create a booking for walk-ins or phone reservations
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBookingSubmit}>
            <div className="py-4 space-y-4">
              {/* Booking Type */}
              <div className="space-y-2">
                <Label htmlFor="booking_type">Booking Type *</Label>
                <Select
                  value={bookingForm.booking_type}
                  onValueChange={(
                    v: "resident" | "board_member" | "external",
                  ) => setBookingForm((prev) => ({ ...prev, booking_type: v }))}
                >
                  <SelectTrigger id="booking_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="board_member">Board Member</SelectItem>
                    <SelectItem value="external">External Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resident/Board Member Fields */}
              {bookingForm.booking_type === "resident" && (
                <div className="relative space-y-2">
                  <Label htmlFor="household_search">Household *</Label>
                  <Input
                    id="household_search"
                    placeholder="Search by address or lot..."
                    value={householdSearch}
                    onChange={(e) => {
                      setHouseholdSearch(e.target.value);
                      setBookingForm((prev) => ({ ...prev, household_id: undefined }));
                    }}
                    autoComplete="off"
                  />
                  {bookingForm.household_id && (
                    <p className="text-xs text-green-600">
                      ✓ Selected: {households.find(h => h.id === bookingForm.household_id)?.address}
                    </p>
                  )}
                  {householdSuggestions.length > 0 && !bookingForm.household_id && (
                    <div className="overflow-y-auto absolute z-50 mt-1 w-full max-h-48 rounded-md border shadow-md bg-popover">
                      {householdSuggestions.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className="px-3 py-2 w-full text-sm text-left cursor-pointer hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setBookingForm((prev) => ({ ...prev, household_id: h.id }));
                            setHouseholdSearch(h.address);
                            setHouseholdSuggestions([]);
                          }}
                        >
                          <span className="font-medium">{h.address}</span>
                          {h.lot_label && (
                            <span className="ml-2 text-xs text-muted-foreground">{h.lot_label}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bookingForm.booking_type === "board_member" && (
                <div className="relative space-y-2">
                  <Label htmlFor="board_member_search">Board Member *</Label>
                  <Input
                    id="board_member_search"
                    placeholder="Search by name or email..."
                    value={boardMemberSearch}
                    onChange={(e) => {
                      setBoardMemberSearch(e.target.value);
                      setBookingForm((prev) => ({ ...prev, user_id: undefined }));
                    }}
                    autoComplete="off"
                  />
                  {bookingForm.user_id && (
                    <p className="text-xs text-green-600">
                      ✓ Selected: {
                        boardMembers.find(bm => bm.user_id === bookingForm.user_id)?.user_name ||
                        boardMembers.find(bm => bm.user_id === bookingForm.user_id)?.user_email
                      }
                    </p>
                  )}
                  {boardMemberSuggestions.length > 0 && !bookingForm.user_id && (
                    <div className="overflow-y-auto absolute z-50 mt-1 w-full max-h-48 rounded-md border shadow-md bg-popover">
                      {boardMemberSuggestions.map((bm) => (
                        <button
                          key={bm.user_id}
                          type="button"
                          className="px-3 py-2 w-full text-sm text-left cursor-pointer hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setBookingForm((prev) => ({ ...prev, user_id: bm.user_id }));
                            setBoardMemberSearch(bm.user_name || bm.user_email);
                            setBoardMemberSuggestions([]);
                          }}
                        >
                          <span className="font-medium">{bm.user_name || "(no name)"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{bm.user_email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* External Rental Fields */}
              {bookingForm.booking_type === "external" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="renter_name">Renter Name *</Label>
                    <Input
                      id="renter_name"
                      placeholder="Full name"
                      value={bookingForm.renter_name || ""}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          renter_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renter_contact">Contact Number</Label>
                    <Input
                      id="renter_contact"
                      placeholder="Phone or email"
                      value={bookingForm.renter_contact || ""}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          renter_contact: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="external_amount">Rental Fee (₱)</Label>
                    <Input
                      id="external_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={bookingForm.amount || ""}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {/* Amenity */}
              <div className="space-y-2">
                <Label htmlFor="amenity_type">Amenity *</Label>
                <Select
                  value={bookingForm.amenity_type}
                  onValueChange={(v: AmenityType) =>
                    setBookingForm((prev) => ({ ...prev, amenity_type: v }))
                  }
                >
                  <SelectTrigger id="amenity_type">
                    <SelectValue placeholder="Select amenity" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {amenityLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Slot */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={bookingForm.date}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot">Time Slot *</Label>
                  <Select
                    value={bookingForm.slot}
                    onValueChange={(v: ReservationSlot) =>
                      setBookingForm((prev) => ({ ...prev, slot: v }))
                    }
                  >
                    <SelectTrigger id="slot">
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">Morning (8AM - 12PM)</SelectItem>
                      <SelectItem value="PM">Afternoon (1PM - 5PM)</SelectItem>
                      <SelectItem value="FULL_DAY">
                        Full Day (8AM - 5PM)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Purpose (for residents/board members) */}
              {bookingForm.booking_type !== "external" && (
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input
                    id="purpose"
                    placeholder="Event or occasion..."
                    value={bookingForm.purpose || ""}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        purpose: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes..."
                  value={bookingForm.notes || ""}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeBookingDialog}
                disabled={isProcessing === "booking"}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing === "booking"}>
                {isProcessing === "booking" ? "Creating..." : "Create Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reservation?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this reservation? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {reservationToDelete && (
            <div className="p-3 space-y-1 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(reservationToDelete.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amenity:</span>
                <span className="font-medium">
                  {amenityLabels[reservationToDelete.amenity_type]}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slot:</span>
                <span className="font-medium">
                  {slotLabels[reservationToDelete.slot]}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">
                  {reservationToDelete.customer_type === "external"
                    ? reservationToDelete.renter_name
                    : reservationToDelete.user_name ||
                      reservationToDelete.household_address}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isProcessing === reservationToDelete?.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteReservation}
              disabled={isProcessing === reservationToDelete?.id}
            >
              {isProcessing === reservationToDelete?.id
                ? "Deleting..."
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
