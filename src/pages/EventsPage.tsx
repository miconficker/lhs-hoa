import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, EventsResponse } from "@/lib/api";
import { format, isPast, isFuture } from "date-fns";
import {
  PlusIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

export function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    loadEvents();
  }, [showUpcoming]);

  async function loadEvents() {
    setLoading(true);
    setError("");

    const result = await api.events.list(showUpcoming);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setEvents(result.data);
    }

    setLoading(false);
  }

  const upcomingEvents =
    events?.events?.filter((e) => isFuture(new Date(e.event_date))) || [];
  const pastEvents =
    events?.events?.filter((e) => isPast(new Date(e.event_date))) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpcoming(!showUpcoming)}
            className={`px-4 py-2 rounded-lg ${showUpcoming ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setShowUpcoming(!showUpcoming)}
            className={`px-4 py-2 rounded-lg ${!showUpcoming ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            Past
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <PlusIcon className="w-5 h-5" />
              New Event
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create Event</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Event title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Event description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Event location"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(showUpcoming ? upcomingEvents : pastEvents).length > 0 ? (
          (showUpcoming ? upcomingEvents : pastEvents).map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              <div className="bg-primary-50 p-4">
                <div className="flex items-center gap-2 text-primary-700">
                  <CalendarIcon className="w-5 h-5" />
                  <span className="font-semibold">
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </span>
                  <span className="text-sm">
                    {format(new Date(event.event_date), "h:mm a")}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {event.title}
                </h3>
                {event.description && (
                  <p className="text-gray-600 text-sm mb-3">
                    {event.description}
                  </p>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPinIcon className="w-4 h-4" />
                    {event.location}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center text-gray-500">
            No {showUpcoming ? "upcoming" : "past"} events found.
          </div>
        )}
      </div>
    </div>
  );
}
