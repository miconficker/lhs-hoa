import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
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
          <Route path="map" element={<div className="text-xl font-semibold">Map coming soon...</div>} />
          <Route path="service-requests" element={<div className="text-xl font-semibold">Service Requests coming soon...</div>} />
          <Route path="reservations" element={<div className="text-xl font-semibold">Reservations coming soon...</div>} />
          <Route path="payments" element={<div className="text-xl font-semibold">Payments coming soon...</div>} />
          <Route path="documents" element={<div className="text-xl font-semibold">Documents coming soon...</div>} />
          <Route path="announcements" element={<div className="text-xl font-semibold">Announcements coming soon...</div>} />
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
