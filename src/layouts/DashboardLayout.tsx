import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  ListOrdered,
  Clock3,
  History,
  BarChart3,
  Bell as BellIcon,
  User,
  LogOut,
  Menu,
  X,
  Search,
  PackageCheck,
  Truck,
  Settings,
  Users as UsersIcon,
  Utensils,
  HeartHandshake,
  Bike,
  ClipboardList,
  ShieldCheck,
  Boxes,
  Activity,
  Map as MapIcon,
  Beaker,
  Lightbulb,
} from 'lucide-react';
import type { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { classNames, roleLabel, initials } from '@/utils/helpers';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navByRole: Record<Role, NavItem[]> = {
  restaurant: [
    { label: 'Dashboard', to: '/restaurant', icon: LayoutDashboard },
    { label: 'Create Donation', to: '/restaurant/create', icon: PlusCircle },
    { label: 'My Donations', to: '/restaurant/donations', icon: ListOrdered },
    { label: 'Active Donations', to: '/restaurant/active', icon: Clock3 },
    { label: 'History', to: '/restaurant/history', icon: History },
    { label: 'Impact', to: '/restaurant/impact', icon: BarChart3 },
    { label: 'Food Waste Insights', to: '/restaurant/insights', icon: Lightbulb },
    { label: 'Notifications', to: '/notifications', icon: BellIcon },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  ngo: [
    { label: 'Dashboard', to: '/ngo', icon: LayoutDashboard },
    { label: 'Discover Donations', to: '/ngo/discover', icon: Search },
    { label: 'Accepted Donations', to: '/ngo/accepted', icon: ClipboardList },
    { label: 'Deliveries', to: '/ngo/deliveries', icon: Truck },
    { label: 'Capacity', to: '/ngo/capacity', icon: Boxes },
    { label: 'Impact', to: '/ngo/impact', icon: BarChart3 },
    { label: 'Notifications', to: '/notifications', icon: BellIcon },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  volunteer: [
    { label: 'Dashboard', to: '/volunteer', icon: LayoutDashboard },
    { label: 'Available Tasks', to: '/volunteer/tasks', icon: Search },
    { label: 'Active Delivery', to: '/volunteer/active', icon: Truck },
    { label: 'History', to: '/volunteer/history', icon: History },
    { label: 'Impact', to: '/volunteer/impact', icon: BarChart3 },
    { label: 'Notifications', to: '/notifications', icon: BellIcon },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'Live Operations', to: '/admin/live', icon: Activity },
    { label: 'Users', to: '/admin/users', icon: UsersIcon },
    { label: 'Donations', to: '/admin/donations', icon: PackageCheck },
    { label: 'Deliveries', to: '/admin/deliveries', icon: Truck },
    { label: 'Verification', to: '/admin/verification', icon: ShieldCheck },
    { label: 'Heatmap', to: '/admin/heatmap', icon: MapIcon },
    { label: 'Simulation', to: '/admin/simulation', icon: Beaker },
    { label: 'Research', to: '/admin/research', icon: BarChart3 },
    { label: 'Profile', to: '/profile', icon: User },
  ],
};

const roleIcon: Record<Role, React.ComponentType<{ className?: string }>> = {
  restaurant: Utensils,
  ngo: HeartHandshake,
  volunteer: Bike,
  admin: ShieldCheck,
};

export function DashboardLayout() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!profile) return null;

  const items = navByRole[profile.role] || [];
  const RoleIcon = roleIcon[profile.role];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (to: string) => {
    const path = to.split('?')[0];
    if (path === `/${profile.role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
          <RoleIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-gray-900 leading-tight">Meal Connect</p>
          <p className="text-xs text-gray-500">{roleLabel(profile.role)} Panel</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={classNames(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium mb-1',
                active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-gray-200 bg-white">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-64 bg-white">{sidebar}</aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <div className="flex items-center gap-2 rounded-lg pl-2 pr-3 py-1.5 hover:bg-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
              {initials(profile.name || profile.email)}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{profile.name || profile.email}</p>
              <p className="text-xs text-gray-500">{roleLabel(profile.role)}</p>
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
