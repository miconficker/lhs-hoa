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
import { PaymentChart } from "@/components/charts/PaymentChart";
import { RequestStatusChart } from "@/components/charts/RequestStatusChart";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  to?: string;
}

function StatCard({ title, value, icon: Icon, color, to }: StatCardProps) {
  const content = (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-card-foreground mt-2">
            {value}
          </p>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <span className="text-sm text-muted-foreground">
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
            <p className="text-muted-foreground">
              Welcome to the Laguna Hills HOA portal. Use the sidebar to
              navigate.
            </p>
          </div>
        )}
      </div>

      {/* Charts Section (for admin/staff) */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">
              Payment Trends
            </h2>
            <PaymentChart height={250} data={stats?.charts?.paymentTrends} />
          </div>
          <div className="bg-card rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">
              Service Request Status
            </h2>
            <RequestStatusChart
              height={250}
              data={stats?.charts?.requestStatus}
            />
          </div>
        </div>
      )}

      {/* Recent Announcements */}
      {stats?.recentAnnouncements && stats.recentAnnouncements.length > 0 && (
        <div className="bg-card rounded-lg shadow">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-card-foreground">
              Recent Announcements
            </h2>
          </div>
          <div className="divide-y divide-border">
            {stats.recentAnnouncements.map((announcement) => (
              <div key={announcement.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                      <h3 className="text-lg font-medium text-card-foreground">
                        {announcement.title}
                      </h3>
                      {announcement.category && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            announcement.category === "urgent"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : announcement.category === "event"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : announcement.category === "policy"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {announcement.category}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {announcement.content}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {format(new Date(announcement.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-muted border-t border-border">
            <Link
              to="/announcements"
              className="text-primary hover:text-primary/80 font-medium text-sm"
            >
              View all announcements →
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions (for admin/staff) */}
      {isAdmin && (
        <div className="bg-card rounded-lg shadow">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-card-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/service-requests"
              className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <ClipboardList className="w-8 h-8 text-primary mb-2" />
              <span className="text-sm font-medium text-card-foreground">
                New Request
              </span>
            </Link>
            <Link
              to="/reservations"
              className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <Calendar className="w-8 h-8 text-primary mb-2" />
              <span className="text-sm font-medium text-card-foreground">
                Book Amenity
              </span>
            </Link>
            <Link
              to="/payments"
              className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <DollarSign className="w-8 h-8 text-primary mb-2" />
              <span className="text-sm font-medium text-card-foreground">
                Pay Dues
              </span>
            </Link>
            <Link
              to="/admin"
              className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <Settings className="w-8 h-8 text-primary mb-2" />
              <span className="text-sm font-medium text-card-foreground">
                Admin Panel
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
