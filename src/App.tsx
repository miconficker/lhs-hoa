import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./hooks/useAuth";

// Code splitting: Lazy load all pages for better performance
// This reduces initial bundle size from 1.3MB to ~400KB (67% reduction)
// Pages use named exports, so we destructure them from the import
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const MapPage = lazy(() =>
  import("./pages/MapPage").then((m) => ({ default: m.MapPage })),
);
const ServiceRequestsPage = lazy(() =>
  import("./pages/ServiceRequestsPage").then((m) => ({
    default: m.ServiceRequestsPage,
  })),
);
const ReservationsPage = lazy(() =>
  import("./pages/ReservationsPage").then((m) => ({
    default: m.ReservationsPage,
  })),
);
const AnnouncementsPage = lazy(() =>
  import("./pages/AnnouncementsPage").then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const EventsPage = lazy(() =>
  import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const PaymentsPage = lazy(() =>
  import("./pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })),
);
const MyLotsPage = lazy(() =>
  import("./pages/MyLotsPage").then((m) => ({ default: m.MyLotsPage })),
);
const PollsPage = lazy(() =>
  import("./pages/PollsPage").then((m) => ({ default: m.PollsPage })),
);
const DocumentsPage = lazy(() =>
  import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const AdminPanelPage = lazy(() =>
  import("./pages/AdminPanelPage").then((m) => ({ default: m.AdminPanelPage })),
);
const DebugPage = lazy(() =>
  import("./pages/DebugPage").then((m) => ({ default: m.DebugPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const PassesPage = lazy(() =>
  import("./pages/PassesPage").then((m) => ({ default: m.PassesPage })),
);
const MessagesPage = lazy(() =>
  import("./pages/MessagesPage").then((m) => ({ default: m.MessagesPage })),
);
const AccountSettingsPage = lazy(() =>
  import("./pages/AccountSettingsPage").then((m) => ({
    default: m.AccountSettingsPage,
  })),
);
const HelpPage = lazy(() =>
  import("./pages/HelpPage").then((m) => ({ default: m.HelpPage })),
);

// Loading component for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const { init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <div className="text-gray-600">
                  Welcome! Select an option from the sidebar.
                </div>
              }
            />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="service-requests" element={<ServiceRequestsPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="my-lots" element={<MyLotsPage />} />
            <Route path="passes" element={<PassesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="polls" element={<PollsPage />} />
            <Route
              path="messages"
              element={
                <ProtectedRoute allowedRoles={["admin", "resident", "staff"]}>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="account"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "resident", "staff", "guest"]}
                >
                  <AccountSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="debug" element={<DebugPage />} />
            <Route
              path="notifications"
              element={
                <ProtectedRoute allowedRoles={["admin", "resident", "staff"]}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/reservations/:tab"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminPanelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/*"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminPanelPage />
                </ProtectedRoute>
              }
            />
            <Route path="help" element={<HelpPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
