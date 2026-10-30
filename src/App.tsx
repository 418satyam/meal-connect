import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { Role } from '@/types';
import type { ReactNode } from 'react';

// Pages
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage, RegisterPage } from '@/pages/AuthPages';
import { CreateDonationPage } from '@/pages/CreateDonationPage';
import { DonationDetailPage } from '@/pages/DonationDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ImpactPage } from '@/pages/ImpactPage';

// Restaurant
import { RestaurantDashboard } from '@/pages/restaurant/RestaurantDashboard';
import { RestaurantDonations } from '@/pages/restaurant/RestaurantDonations';
import { RestaurantInsights } from '@/pages/restaurant/RestaurantInsights';

// NGO
import { NgoDashboard } from '@/pages/ngo/NgoDashboard';
import { NgoDiscover } from '@/pages/ngo/NgoDiscover';
import { NgoAccepted } from '@/pages/ngo/NgoAccepted';
import { NgoDeliveries } from '@/pages/ngo/NgoDeliveries';
import { NgoCapacity } from '@/pages/ngo/NgoCapacity';

// Volunteer
import { VolunteerDashboard } from '@/pages/volunteer/VolunteerDashboard';
import { VolunteerTasks } from '@/pages/volunteer/VolunteerTasks';
import { VolunteerActiveDelivery } from '@/pages/volunteer/VolunteerActiveDelivery';
import { VolunteerHistory } from '@/pages/volunteer/VolunteerHistory';

// Admin
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminDonations } from '@/pages/admin/AdminDonations';
import { AdminDeliveries } from '@/pages/admin/AdminDeliveries';
import { AdminVerification } from '@/pages/admin/AdminVerification';
import { AdminLiveOperations } from '@/pages/admin/AdminLiveOperations';
import { AdminHeatmap } from '@/pages/admin/AdminHeatmap';
import { AdminSimulation } from '@/pages/admin/AdminSimulation';
import { AdminResearch } from '@/pages/admin/AdminResearch';

// Layout
import { DashboardLayout } from '@/layouts/DashboardLayout';

function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner label="Loading..." />;
  if (!profile) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner label="Loading..." />;
  if (!profile) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profile.role !== role) return <Navigate to={`/${profile.role}`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Shared */}
      <Route path="/donations/:id" element={<RequireAuth><DonationDetailPage /></RequireAuth>} />

      {/* Restaurant */}
      <Route path="/restaurant" element={<RequireRole role="restaurant"><DashboardLayout /></RequireRole>}>
        <Route index element={<RestaurantDashboard />} />
        <Route path="create" element={<CreateDonationPage />} />
        <Route path="donations" element={<RestaurantDonations filter="all" title="My Donations" />} />
        <Route path="active" element={<RestaurantDonations filter="active" title="Active Donations" />} />
        <Route path="history" element={<RestaurantDonations filter="history" title="Donation History" />} />
        <Route path="impact" element={<ImpactPage role="restaurant" />} />
        <Route path="insights" element={<RestaurantInsights />} />
      </Route>

      {/* NGO */}
      <Route path="/ngo" element={<RequireRole role="ngo"><DashboardLayout /></RequireRole>}>
        <Route index element={<NgoDashboard />} />
        <Route path="discover" element={<NgoDiscover />} />
        <Route path="accepted" element={<NgoAccepted />} />
        <Route path="deliveries" element={<NgoDeliveries />} />
        <Route path="capacity" element={<NgoCapacity />} />
        <Route path="impact" element={<ImpactPage role="ngo" />} />
      </Route>

      {/* Volunteer */}
      <Route path="/volunteer" element={<RequireRole role="volunteer"><DashboardLayout /></RequireRole>}>
        <Route index element={<VolunteerDashboard />} />
        <Route path="tasks" element={<VolunteerTasks />} />
        <Route path="active" element={<VolunteerTasks />} />
        <Route path="delivery/:id" element={<VolunteerActiveDelivery />} />
        <Route path="history" element={<VolunteerHistory />} />
        <Route path="impact" element={<ImpactPage role="volunteer" />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<RequireRole role="admin"><DashboardLayout /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="live" element={<AdminLiveOperations />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="donations" element={<AdminDonations />} />
        <Route path="deliveries" element={<AdminDeliveries />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="heatmap" element={<AdminHeatmap />} />
        <Route path="simulation" element={<AdminSimulation />} />
        <Route path="research" element={<AdminResearch />} />
      </Route>

      {/* Shared within any dashboard */}
      <Route path="/notifications" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<NotificationsPage />} />
      </Route>
      <Route path="/profile" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<ProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
