import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AdminReservationsPage from "./admin/reservations/index";
import { AdminLotsPage } from "./AdminLotsPage";
import { LotsManagementPage } from "@/components/admin/lots/LotsManagementPage";
import { DuesConfigPage } from "./DuesConfigPage";
import { InPersonPaymentsPage } from "./InPersonPaymentsPage";
import { CommonAreasPage } from "./CommonAreasPage";
import { PassManagementPage } from "./PassManagementPage";
import { WhitelistManagementPage } from "./WhitelistManagementPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { NotificationsPage } from "./NotificationsPage";
import { MessagesPage } from "./MessagesPage";
import { PaymentsPage } from "./PaymentsPage";
import { DelinquencyPage } from "./admin/financials/DelinquencyPage";
import { PaymentVerificationQueue } from "@/components/PaymentVerificationQueue";
import { PaymentChart } from "@/components/charts/PaymentChart";
import { RequestStatusChart } from "@/components/charts/RequestStatusChart";
import { Callout } from "@/components/ui/callout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { IconContainer } from "@/components/ui/icon-container";
import { Users, Bell, CreditCard, Building2 } from "lucide-react";

export function AdminPanelPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Get the current path section using React Router's location
  const pathSection = location.pathname.replace("/admin/", "").split("/")[0];

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const response = await api.admin.getStats();
    if (response.data) {
      setStats(response.data.stats);
    }
    setLoading(false);
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <Callout variant="error" title="Access Denied">
          You don't have permission to access this page.
        </Callout>
      </div>
    );
  }

  // Handle dedicated admin pages
  if (pathSection === "reservations") {
    return <AdminReservationsPage />;
  }
  if (pathSection === "lots") {
    return <AdminLotsPage />;
  }
  if (pathSection === "lot-members") {
    return (
      <div className="p-6">
        <LotsManagementPage />
      </div>
    );
  }
  if (pathSection === "dues") {
    return <DuesConfigPage />;
  }
  if (pathSection === "payments" && location.pathname.includes("in-person")) {
    return <InPersonPaymentsPage />;
  }
  if (pathSection === "common-areas") {
    return <CommonAreasPage />;
  }
  if (pathSection === "pass-management") {
    return <PassManagementPage />;
  }
  if (pathSection === "whitelist") {
    return <WhitelistManagementPage />;
  }
  if (pathSection === "pre-approved") {
    return <WhitelistManagementPage />;
  }
  if (pathSection === "residents") {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Use the Users page from the sidebar.
        </p>
      </div>
    );
  }
  if (pathSection === "announcements") {
    return <AnnouncementsPage />;
  }
  if (pathSection === "notifications") {
    return <NotificationsPage />;
  }
  if (pathSection === "messages") {
    return <MessagesPage />;
  }
  if (pathSection === "payments" && !location.pathname.includes("in-person")) {
    return <PaymentsPage />;
  }
  if (
    pathSection === "financials" &&
    location.pathname.includes("delinquency")
  ) {
    return <DelinquencyPage />;
  }
  if (pathSection === "dues-settings") {
    return <DuesConfigPage />;
  }
  if (pathSection === "verification-queue") {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Payment Verification Queue</h1>
        <PaymentVerificationQueue status="pending" onRefresh={() => {}} />
      </div>
    );
  }
  if (pathSection === "settings") {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <div className="bg-white dark:bg-card rounded-lg shadow p-6">
          <p className="text-muted-foreground">
            System settings coming soon...
          </p>
        </div>
      </div>
    );
  }

  // Dashboard overview
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of system status and quick actions
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Users Stats */}
          <Link
            to="/admin/users"
            className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Users
            </h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.users.total}
            </p>
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-4">
              Manage users →
            </p>
          </Link>

          {/* Households Stats */}
          <Link
            to="/admin/lots"
            className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Households
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.households.total}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-4">
              View properties →
            </p>
          </Link>

          {/* Residents Stats */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Total Residents
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.residents}
            </p>
          </div>

          {/* Payments Stats */}
          <Link
            to="/admin/payments"
            className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Unpaid Payments
            </h3>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {stats.payments.unpaid}
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              PHP {stats.payments.unpaidAmount.toLocaleString()}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-4">
              View payments →
            </p>
          </Link>
        </div>
      ) : null}

      {/* Charts Section */}
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

      {/* Quick Actions */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <IconContainer icon={Users} variant="info" size="md" />
            <div>
              <p className="font-medium text-card-foreground">Manage Users</p>
              <p className="text-sm text-muted-foreground">Add or edit users</p>
            </div>
          </Link>

          <Link
            to="/admin/lots"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <IconContainer icon={Building2} variant="success" size="md" />
            <div>
              <p className="font-medium text-card-foreground">Properties</p>
              <p className="text-sm text-muted-foreground">View lots & maps</p>
            </div>
          </Link>

          <Link
            to="/admin/announcements"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <IconContainer icon={Bell} variant="primary" size="md" />
            <div>
              <p className="font-medium text-card-foreground">Announcements</p>
              <p className="text-sm text-muted-foreground">Send updates</p>
            </div>
          </Link>

          <Link
            to="/admin/payments"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <IconContainer icon={CreditCard} variant="warning" size="md" />
            <div>
              <p className="font-medium text-card-foreground">Payments</p>
              <p className="text-sm text-muted-foreground">View transactions</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
