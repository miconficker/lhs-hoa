import { useState, useEffect } from "react";
import { Trash2, CheckCircle2, Bell, Filter } from "lucide-react";
import { api } from "@/lib/api";
import type { Notification, NotificationType } from "@/types";
import { cn } from "@/lib/utils";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<NotificationType | "all">("all");
  const [filterRead, setFilterRead] = useState<boolean | "all">("all");

  const fetchNotifications = async () => {
    setLoading(true);
    const params: { type?: string; read?: boolean } = {};
    if (filterType !== "all") params.type = filterType;
    if (filterRead !== "all") params.read = filterRead;

    const response = await api.notifications.list(params);
    if (response.data) {
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [filterType, filterRead]);

  const markAsRead = async (id: string) => {
    await api.notifications.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await api.notifications.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) {
      return;
    }
    await api.notifications.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notifications.find((n) => n.id === id)?.read === false) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "demand_letter":
        return "📄";
      case "reminder":
        return "⏰";
      case "late_notice":
        return "⚠️";
      case "announcement":
        return "📢";
      case "alert":
        return "🚨";
      default:
        return "📌";
    }
  };

  const getTypeLabel = (type: NotificationType) => {
    switch (type) {
      case "demand_letter":
        return "Demand Letter";
      case "reminder":
        return "Reminder";
      case "late_notice":
        return "Late Notice";
      case "announcement":
        return "Announcement";
      case "alert":
        return "Alert";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60)
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return formatDate(dateString);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700 font-medium">Filters:</span>
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as NotificationType | "all")
          }
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Types</option>
          <option value="demand_letter">Demand Letters</option>
          <option value="reminder">Reminders</option>
          <option value="late_notice">Late Notices</option>
          <option value="announcement">Announcements</option>
          <option value="alert">Alerts</option>
        </select>

        {/* Read status filter */}
        <select
          value={filterRead.toString()}
          onChange={(e) =>
            setFilterRead(
              e.target.value === "all" ? "all" : e.target.value === "true",
            )
          }
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Status</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No notifications found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filterType !== "all" || filterRead !== "all"
              ? "Try adjusting your filters"
              : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "bg-white rounded-lg border transition-all hover:shadow-md",
                !notification.read
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-200",
              )}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={cn(
                              "text-lg font-semibold",
                              !notification.read
                                ? "text-gray-900"
                                : "text-gray-700",
                            )}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">
                          {notification.content}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium">
                            {getTypeLabel(notification.type)}
                          </span>
                          <span>
                            {getRelativeTime(notification.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Link */}
                    {notification.link && (
                      <a
                        href={notification.link}
                        onClick={() => markAsRead(notification.id)}
                        className="inline-block mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View details →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
