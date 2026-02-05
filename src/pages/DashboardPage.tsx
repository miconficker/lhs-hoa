import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api, DashboardStatsResponse } from "@/lib/api";
import { format } from "date-fns";
import {
  Home,
  ClipboardList,
  Calendar,
  DollarSign,
  AlertTriangle,
  Settings,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  to?: string;
}

function StatCard({ title, value, icon: Icon, color, to }: StatCardProps) {
  const content = (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError("");

      const result = await api.dashboard.getStats();

      if (result.error || !result.data) {
        setError(result.error || "Failed to load dashboard");
      } else {
        setStats(result.data);
      }

      setLoading(false);
    }

    loadStats();
  }, []);

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

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          Welcome back, {user?.email}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isAdmin ? (
          <>
            <StatCard
              title="Total Households"
              value={stats?.stats.households || 0}
              icon={Home}
              color="bg-blue-500"
              to="/map"
            />
            <StatCard
              title="Pending Requests"
              value={stats?.stats.pendingRequests || 0}
              icon={ClipboardList}
              color="bg-yellow-500"
              to="/service-requests"
            />
            <StatCard
              title="Upcoming Reservations"
              value={stats?.stats.upcomingReservations || 0}
              icon={Calendar}
              color="bg-green-500"
              to="/reservations"
            />
            <StatCard
              title="Unpaid Payments"
              value={stats?.stats.unpaidPayments || 0}
              icon={DollarSign}
              color="bg-red-500"
              to="/payments"
            />
          </>
        ) : (
          <div className="col-span-full">
            <p className="text-gray-600">
              Welcome to the Laguna Hills HOA portal. Use the sidebar to
              navigate.
            </p>
          </div>
        )}
      </div>

      {/* Recent Announcements */}
      {stats?.recentAnnouncements && stats.recentAnnouncements.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Announcements
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.recentAnnouncements.map((announcement) => (
              <div key={announcement.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                      <h3 className="text-lg font-medium text-gray-900">
                        {announcement.title}
                      </h3>
                      {announcement.category && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            announcement.category === "urgent"
                              ? "bg-red-100 text-red-700"
                              : announcement.category === "event"
                                ? "bg-blue-100 text-blue-700"
                                : announcement.category === "policy"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {announcement.category}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{announcement.content}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {format(new Date(announcement.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <Link
              to="/announcements"
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              View all announcements →
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions (for admin/staff) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Quick Actions
            </h2>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/service-requests"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ClipboardList className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium">New Request</span>
            </Link>
            <Link
              to="/reservations"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium">Book Amenity</span>
            </Link>
            <Link
              to="/payments"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <DollarSign className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium">Pay Dues</span>
            </Link>
            <Link
              to="/admin"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium">Admin Panel</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
