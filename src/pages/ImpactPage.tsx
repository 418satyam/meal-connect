import { useEffect, useState } from 'react';
import { Package, CheckCircle2, Users, Scale, Award, TrendingUp, XCircle, AlertTriangle, Percent } from 'lucide-react';
import { getImpactMetrics } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { ImpactMetrics } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { DashboardCard } from '@/components/DashboardCard';
import { formatNumber, classNames } from '@/utils/helpers';

export function ImpactPage({ role }: { role: 'restaurant' | 'ngo' | 'volunteer' | 'admin' }) {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!profile) return;
      try {
        setMetrics(await getImpactMetrics(profile.id, role));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile, role]);

  if (loading) return <LoadingSpinner label="Calculating impact..." />;
  if (error) return <ErrorState message={error} />;
  if (!metrics) return <ErrorState message="Could not load impact metrics." />;

  const titles: Record<string, string> = {
    restaurant: 'Your Impact',
    ngo: 'NGO Impact',
    volunteer: 'Volunteer Impact',
    admin: 'Meal Connect Impact',
  };

  const hasData = metrics.total_donations > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{titles[role]}</h1>
        <p className="text-sm text-gray-500">See the real difference you're making.</p>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No impact data yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            {role === 'restaurant' ? 'Create donations and complete deliveries to see your impact here.' :
             role === 'ngo' ? 'Accept and complete donations to see your impact here.' :
             role === 'volunteer' ? 'Complete delivery tasks to see your impact here.' :
             'Once donations flow through the platform, impact metrics will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Hero card */}
          <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8" />
              <div>
                <p className="text-sm text-green-50">Meals Rescued</p>
                <p className="text-4xl font-bold">{formatNumber(metrics.meals_rescued)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard title="Donations Completed" value={formatNumber(metrics.donations_completed)} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
            <DashboardCard title="People Served" value={formatNumber(metrics.people_served)} icon={<Users className="h-5 w-5" />} color="blue" />
            <DashboardCard
              title="Food Redistributed"
              value={formatNumber(metrics.food_weight_estimate)}
              subtitle="kg (estimated)"
              icon={<Scale className="h-5 w-5" />}
              color="green"
            />
            <DashboardCard
              title="Rescue Success Rate"
              value={metrics.rescue_success_rate !== null ? `${metrics.rescue_success_rate}%` : '—'}
              icon={<Percent className="h-5 w-5" />}
              color="amber"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-gray-500">Completed</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(metrics.donations_completed)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm font-medium text-gray-500">Expired</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(metrics.donations_expired)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <p className="text-sm font-medium text-gray-500">Cancelled</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(metrics.donations_cancelled)}</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" /> Impact Breakdown
            </h2>
            <div className="mt-4 space-y-3">
              <BarRow label="Meals Served" value={metrics.meals_rescued} max={Math.max(metrics.meals_rescued, 1)} color="bg-green-500" />
              <BarRow label="Food Redistributed (kg, est.)" value={metrics.food_weight_estimate} max={Math.max(metrics.food_weight_estimate, 1)} color="bg-blue-500" />
              <BarRow label="Completed Donations" value={metrics.donations_completed} max={Math.max(metrics.donations_completed, 1)} color="bg-teal-500" />
            </div>
          </div>

          {/* Estimates disclaimer */}
          <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-500">
            <p className="font-medium text-gray-600">About these estimates</p>
            <p className="mt-1">
              Food weight (kg) is estimated from serving counts using an average portion size and is not a scientifically exact measurement.
              Rescue success rate is calculated as completed donations divided by total completed, expired, and cancelled donations.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{formatNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={classNames('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
