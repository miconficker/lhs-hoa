import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, AnnouncementsResponse } from "@/lib/api";
import { format } from "date-fns";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { AnnouncementCategory } from "@/types";

const categoryColors: Record<AnnouncementCategory, string> = {
  event: "bg-blue-100 text-blue-700",
  urgent: "bg-red-100 text-destructive",
  info: "bg-gray-100 text-card-foreground",
  policy: "bg-purple-100 text-purple-700",
};

const categoryLabels: Record<AnnouncementCategory, string> = {
  event: "Event",
  urgent: "Urgent",
  info: "Info",
  policy: "Policy",
};

export function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] =
    useState<AnnouncementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    const result = await api.announcements.list(50, 0);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setAnnouncements(result.data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          Announcements
        </h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            New Announcement
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create Announcement</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Title
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Content
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Announcement content"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Category
                </label>
                <select className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500">
                  <option value="info">Info</option>
                  <option value="urgent">Urgent</option>
                  <option value="event">Event</option>
                  <option value="policy">Policy</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Expires At
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                className="rounded border-border"
              />
              <label htmlFor="pinned" className="text-sm text-card-foreground">
                Pin to top
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
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

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements?.announcements &&
        announcements.announcements.length > 0 ? (
          announcements.announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="bg-card rounded-lg shadow p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.is_pinned && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                        Pinned
                      </span>
                    )}
                    {announcement.category && (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[announcement.category]}`}
                      >
                        {categoryLabels[announcement.category]}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {announcement.title}
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {announcement.content}
                  </p>
                  <p className="text-sm text-gray-400 mt-4">
                    {format(
                      new Date(announcement.created_at),
                      "MMMM d, yyyy 'at' h:mm a",
                    )}
                    {announcement.expires_at &&
                      ` • Expires ${format(new Date(announcement.expires_at), "MMM d, yyyy")}`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="ml-4 flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-muted-foreground">
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-lg shadow p-12 text-center text-gray-500">
            No announcements found.
          </div>
        )}
      </div>
    </div>
  );
}
