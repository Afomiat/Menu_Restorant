import { Routes, Route, Navigate } from 'react-router-dom';
import MenuPage from './pages/MenuPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import { AdminDashboardPage } from './admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<Navigate to="/breath/admin" replace />} />
      <Route path="/:restaurantName/admin" element={<AdminDashboardPage />} />
      <Route path="/:restaurantName" element={<MenuPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
