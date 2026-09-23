import { Routes, Route, Navigate } from 'react-router-dom';
import MenuPage from './pages/MenuPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import { AdminDashboardPage } from './admin';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<Navigate to="/azai-burger/admin" replace />} />
        <Route path="/admin/:restaurantName" element={<AdminDashboardPage />} />
        <Route path="/:restaurantName/admin" element={<AdminDashboardPage />} />
        <Route path="/:restaurantName" element={<MenuPage />} />
        {/* Support QR-scanned /m/:restaurantName URLs */}
        <Route path="/m/:restaurantName" element={<MenuPage />} />
        <Route path="/m/:restaurantName/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
