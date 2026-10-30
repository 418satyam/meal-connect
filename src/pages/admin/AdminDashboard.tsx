import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Utensils, HeartHandshake, Bike, Package, Clock, CheckCircle2, Truck, Scale, PackageCheck, Activity, Map as MapIcon, Beaker, BarChart3, ArrowRight } from 'lucide-react';
import { adminDashboard, getImpactMetrics } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { DashboardCard } from '@/components/DashboardCard';
import { formatNumber } from '@/utils/helpers';
import type { ImpactMetrics } from '@/types';

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, i] = await Promise.all([
        adminDashboard(),
        profile ? getImpactMetrics(profile.id, 'admin') : Promise.resolve(null),
      ]);
      setStats(s);
      setImpact(i);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [profile]);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Platform-wide overview of Meal Connect.</p>
      </div>

      {/* Quick links to new admin features */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink to="/admin/live" icon={Activity} label="Live Operations" desc="Real-time monitoring" color="bg-green-50 text-green-600" />
        <QuickLink to="/admin/heatmap" icon={MapIcon} label="Heatmap" desc="Surplus vs demand" color="bg-blue-50 text-blue-600" />
        <QuickLink to="/admin/simulation" icon={Beaker} label="Simulation" desc="What-if analysis" color="bg-purple-50 text-purple-600" />
        <QuickLink to="/admin/research" icon={BarChart3} label="Research" desc="Smart vs traditional" color="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <PackageCheck className="h-10 w-10" />
          <div>
            <p className="text-sm text-green-50">Meals Distributed</p>
            <p className="text-4xl font-bold">{formatNumber(stats.meals_distributed)}</p>
          </div>
        </div>
      </div>

      {/* Platform impact metrics */}
      {impact && impact.total_donations > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard title="Meals Rescued" value={formatNumber(impact.meals_rescued)} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
          <DashboardCard title="Food Redistributed" value={formatNumber(impact.food_weight_estimate)} subtitle="kg (est.)" icon={<Scale className="h-5 w-5" />} color="green" />
          <DashboardCard title="Rescue Success Rate" value={impact.rescue_success_rate !== null ? `${impact.rescue_success_rate}%` : '—'} icon={<CheckCircle2 className="h-5 w-5" />} color="amber" />
          <DashboardCard title="Expired" value={formatNumber(impact.donations_expired)} icon={<Clock className="h-5 w-5" />} color="red" />
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Users</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard title="Total Users" value={stats.total_users} icon={<Users className="h-5 w-5" />} color="green" />
          <DashboardCard title="Restaurants" value={stats.restaurants} icon={<Utensils className="h-5 w-5" />} color="amber" />
          <DashboardCard title="NGOs" value={stats.ngos} icon={<HeartHandshake className="h-5 w-5" />} color="blue" />
          <DashboardCard title="Volunteers" value={stats.volunteers} icon={<Bike className="h-5 w-5" />} color="purple" />
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Donations & Deliveries</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <DashboardCard title="Total Donations" value={stats.total_donations} icon={<Package className="h-5 w-5" />} color="green" />
          <DashboardCard title="Active" value={stats.active_donations} icon={<Clock className="h-5 w-5" />} color="amber" />
          <DashboardCard title="Completed" value={stats.completed_donations} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
          <DashboardCard title="Active Deliveries" value={stats.active_deliveries} icon={<Truck className="h-5 w-5" />} color="indigo" />
          <DashboardCard title="Food Rescued" value={stats.food_rescued} subtitle="units" icon={<Scale className="h-5 w-5" />} color="cyan" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, desc, color }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </Link>
  );
}
