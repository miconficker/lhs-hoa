import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { ServiceRequestsPage } from './pages/ServiceRequestsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { EventsPage } from './pages/EventsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { useAuth } from './hooks/useAuth';

function App() {
  const { init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
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
          <Route index element={<div className="text-gray-600">Welcome! Select an option from the sidebar.</div>} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="service-requests" element={<ServiceRequestsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="documents" element={<div className="text-xl font-semibold">Documents coming soon...</div>} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div className="text-xl font-semibold">Admin Panel coming soon...</div>
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
