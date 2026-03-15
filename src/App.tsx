import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { AdminLayout } from "./pages/admin/AdminLayout";
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
const MemberApprovalsPage = lazy(() =>
  import("./pages/admin/MemberApprovalsPage").then((m) => ({
    default: m.MemberApprovalsPage,
  })),
);
const UsersSection = lazy(() =>
  import("./pages/admin/users/index").then((m) => ({
    default: m.UsersSection,
  })),
);
const BookingAnalyticsPage = lazy(() =>
  import("./pages/admin/analytics/BookingAnalyticsPage").then((m) => ({
    default: m.BookingAnalyticsPage,
  })),
);
const CreateBookingPage = lazy(() =>
  import("./pages/admin/create-booking/CreateBookingPage").then((m) => ({
    default: m.CreateBookingPage,
  })),
);
const NotificationBadgeTest = lazy(() =>
  import("./pages/admin/test/NotificationBadgeTestPage").then((m) => ({
    default: m.NotificationBadgeTestPage,
  })),
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

const BookingPaymentPage = lazy(() =>
  import("./pages/bookings/BookingPaymentPage").then((m) => ({
    default: m.BookingPaymentPage,
  })),
);
const BookingDetailsPage = lazy(() =>
  import("./pages/bookings/BookingDetailsPage").then((m) => ({
    default: m.BookingDetailsPage,
  })),
);

// Public pages (no authentication required)
const LandingPage = lazy(() =>
  import("./pages/public/LandingPage").then((m) => ({
    default: m.LandingPage,
  })),
);
const ExternalRentalsPage = lazy(() =>
  import("./pages/public/ExternalRentalsPage").then((m) => ({
    default: m.ExternalRentalsPage,
  })),
);
const AmenityDetailPage = lazy(() =>
  import("./pages/public/AmenityDetailPage").then((m) => ({
    default: m.AmenityDetailPage,
  })),
);
const InquiryPage = lazy(() =>
  import("./pages/public/InquiryPage").then((m) => ({
    default: m.InquiryPage,
  })),
);
const InquiryPendingPage = lazy(() =>
  import("./pages/public/InquiryPendingPage").then((m) => ({
    default: m.InquiryPendingPage,
  })),
);
const InquiryPaymentPage = lazy(() =>
  import("./pages/public/InquiryPaymentPage").then((m) => ({
    default: m.InquiryPaymentPage,
  })),
);
const ConfirmationPage = lazy(() =>
  import("./pages/public/ConfirmationPage").then((m) => ({
    default: m.ConfirmationPage,
  })),
);
const SuccessPage = lazy(() =>
  import("./pages/public/SuccessPage").then((m) => ({
    default: m.SuccessPage,
  })),
);
const StatusCheckPage = lazy(() =>
  import("./pages/public/StatusCheckPage").then((m) => ({
    default: m.StatusCheckPage,
  })),
);
const StatusByRefPage = lazy(() =>
  import("./pages/public/StatusByRefPage").then((m) => ({
    default: m.StatusByRefPage,
  })),
);

// Loading component for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex justify-center items-center h-screen bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full border-b-2 animate-spin border-primary"></div>
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
          {/* Public landing page - no auth required */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
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
              path="bookings/:id/payment"
              element={<BookingPaymentPage />}
            />
            <Route
              path="bookings/:id/details"
              element={<BookingDetailsPage />}
            />
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
                  <AdminLayout>
                    <AdminPanelPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <UsersSection />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/member-approvals"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <MemberApprovalsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/analytics"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <BookingAnalyticsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/create-booking"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <CreateBookingPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/test/notification-badges"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <NotificationBadgeTest />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/*"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <AdminPanelPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route path="help" element={<HelpPage />} />
          </Route>

          {/* Public routes - no authentication required */}
          <Route path="/external-rentals" element={<ExternalRentalsPage />} />
          <Route
            path="/external-rentals/:amenityType"
            element={<AmenityDetailPage />}
          />
          <Route path="/external-rentals/book" element={<InquiryPage />} />
          <Route
            path="/external-rentals/inquiry/:id/pending"
            element={<InquiryPendingPage />}
          />
          <Route
            path="/external-rentals/inquiry/:id/payment"
            element={<InquiryPaymentPage />}
          />
          <Route
            path="/external-rentals/confirmation/:id"
            element={<ConfirmationPage />}
          />
          <Route
            path="/external-rentals/success/:id"
            element={<SuccessPage />}
          />
          <Route path="/status" element={<StatusCheckPage />} />
          <Route path="/status/:ref" element={<StatusByRefPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
