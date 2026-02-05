import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ReservationsResponse, AvailabilityResponse } from "@/lib/api";
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { Calendar, Clock, Plus, X, Check, XCircle } from "lucide-react";
import type {
  AmenityType,
  ReservationSlot,
  ReservationStatus,
  AmenityAvailability,
} from "@/types";

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
};

const amenityIcons: Record<AmenityType, string> = {
  clubhouse: "🏠",
  pool: "🏊",
  "basketball-court": "🏀",
};

const statusColors: Record<ReservationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const slotLabels: Record<ReservationSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
};

interface BookingForm {
  household_id: string;
  amenity_type: AmenityType;
  date: string;
  slot: ReservationSlot;
  purpose: string;
}

export function ReservationsPage() {
  const { user } = useAuth();
  const [myReservations, setMyReservations] =
    useState<ReservationsResponse | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [viewMonth, setViewMonth] = useState(new Date());

  // Form state
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    household_id: "",
    amenity_type: "clubhouse",
    date: format(new Date(), "yyyy-MM-dd"),
    slot: "AM",
    purpose: "",
  });

  // Mock household ID - in production, this would come from user's household relation
  const householdId = user?.id || "mock-household-id";

  useEffect(() => {
    loadData();
  }, [viewMonth, bookingForm.amenity_type]);

  async function loadData() {
    setLoading(true);
    setError("");

    // Load my reservations
    const myResResult = await api.reservations.getMy(householdId);
    if (myResResult.error) {
      setError(myResResult.error);
    } else if (myResResult.data) {
      setMyReservations(myResResult.data);
    }

    // Load availability for current month
    const monthStart = format(startOfMonth(viewMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(viewMonth), "yyyy-MM-dd");
    const availResult = await api.reservations.getAvailability(
      monthStart,
      monthEnd,
      bookingForm.amenity_type,
    );
    if (availResult.error) {
      setError(availResult.error);
    } else if (availResult.data) {
      setAvailability(availResult.data);
    }

    setLoading(false);
  }

  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const result = await api.reservations.create({
      household_id: householdId,
      amenity_type: bookingForm.amenity_type,
      date: bookingForm.date,
      slot: bookingForm.slot,
      purpose: bookingForm.purpose || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Reservation created successfully!");
      setShowBookingForm(false);
      setBookingForm({
        household_id: householdId,
        amenity_type: "clubhouse",
        date: format(new Date(), "yyyy-MM-dd"),
        slot: "AM",
        purpose: "",
      });
      loadData();
    }
  }

  async function handleCancelReservation(reservationId: string) {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;

    const result = await api.reservations.update(reservationId, {
      status: "cancelled",
    });
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Reservation cancelled successfully!");
      loadData();
    }
  }

  function getAvailabilityForDate(date: Date): AmenityAvailability | undefined {
    const dateStr = format(date, "yyyy-MM-dd");
    return availability?.availability.find((a) => a.date === dateStr);
  }

  function isSlotAvailable(date: Date, slot: ReservationSlot): boolean {
    const avail = getAvailabilityForDate(date);
    if (!avail) return true;
    return slot === "AM" ? avail.am_available : avail.pm_available;
  }

  function renderCalendar() {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add padding days for proper week alignment
    const firstDayOfWeek = monthStart.getDay();
    const paddingDays = Array.from({ length: firstDayOfWeek }, () => null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
        {paddingDays.map((_, idx) => (
          <div key={`padding-${idx}`} className="h-24 bg-gray-50" />
        ))}
        {days.map((day) => {
          const avail = getAvailabilityForDate(day);
          const isPast = day < today;

          return (
            <div
              key={day.toISOString()}
              className={`h-24 border border-gray-200 p-2 cursor-pointer transition-colors ${
                isPast ? "bg-gray-100 opacity-50" : "hover:bg-blue-50"
              }`}
              onClick={() =>
                !isPast &&
                setBookingForm({
                  ...bookingForm,
                  date: format(day, "yyyy-MM-dd"),
                })
              }
            >
              <div className="text-sm font-medium text-gray-900 mb-1">
                {format(day, "d")}
              </div>
              {!isPast && avail && (
                <div className="space-y-1">
                  <div
                    className={`text-xs px-1 py-0.5 rounded ${avail.am_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    AM: {avail.am_available ? "Available" : "Booked"}
                  </div>
                  <div
                    className={`text-xs px-1 py-0.5 rounded ${avail.pm_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    PM: {avail.pm_available ? "Available" : "Booked"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (loading && !myReservations) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Amenity Reservations
        </h1>
        <button
          onClick={() => setShowBookingForm(!showBookingForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {showBookingForm ? (
            <X className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {showBookingForm ? "Cancel" : "New Reservation"}
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Booking Form */}
      {showBookingForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Book an Amenity
          </h2>
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amenity
                </label>
                <select
                  value={bookingForm.amenity_type}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      amenity_type: e.target.value as AmenityType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="clubhouse">🏠 Clubhouse</option>
                  <option value="pool">🏊 Swimming Pool</option>
                  <option value="basketball-court">🏀 Basketball Court</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, date: e.target.value })
                  }
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["AM", "PM"] as ReservationSlot[]).map((slot) => {
                    const available = isSlotAvailable(
                      parseISO(bookingForm.date),
                      slot,
                    );
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, slot })}
                        disabled={!available}
                        className={`px-3 py-2 border rounded-lg text-center transition-colors ${
                          bookingForm.slot === slot
                            ? "bg-primary-600 text-white border-primary-600"
                            : available
                              ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        }`}
                      >
                        {slotLabels[slot]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose (Optional)
                </label>
                <input
                  type="text"
                  value={bookingForm.purpose}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, purpose: e.target.value })
                  }
                  placeholder="e.g., Birthday party, Family gathering"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create Reservation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Availability Calendar - {amenityLabels[bookingForm.amenity_type]}
          </h2>
          <div className="flex items-center gap-4">
            <select
              value={bookingForm.amenity_type}
              onChange={(e) =>
                setBookingForm({
                  ...bookingForm,
                  amenity_type: e.target.value as AmenityType,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="clubhouse">🏠 Clubhouse</option>
              <option value="pool">🏊 Swimming Pool</option>
              <option value="basketball-court">🏀 Basketball Court</option>
            </select>
            <button
              onClick={() => setViewMonth(addDays(viewMonth, -30))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-gray-700">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setViewMonth(addDays(viewMonth, 30))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              Next
            </button>
          </div>
        </div>
        {renderCalendar()}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 rounded"></div>
            <span>Booked</span>
          </div>
        </div>
      </div>

      {/* My Reservations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          My Reservations
        </h2>
        {myReservations?.reservations &&
        myReservations.reservations.length > 0 ? (
          <div className="space-y-4">
            {myReservations.reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">
                    {amenityIcons[reservation.amenity_type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">
                        {amenityLabels[reservation.amenity_type]}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[reservation.status]}`}
                      >
                        {reservation.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(reservation.date), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {slotLabels[reservation.slot]}
                      </span>
                    </div>
                    {reservation.purpose && (
                      <p className="text-sm text-gray-500 mt-1">
                        Purpose: {reservation.purpose}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Booked on{" "}
                      {format(new Date(reservation.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                {reservation.status !== "cancelled" && (
                  <button
                    onClick={() => handleCancelReservation(reservation.id)}
                    className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No reservations found. Create your first reservation to get started.
          </div>
        )}
      </div>
    </div>
  );
}
