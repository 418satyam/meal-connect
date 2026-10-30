import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Siren, AlertTriangle, Truck, CheckCircle2, Clock, Package,
  Users, Search, XCircle, Activity, FileWarning,
} from 'lucide-react';
import { getLiveOperations, adminFetchDonations } from '@/services/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { DashboardCard } from '@/components/DashboardCard';
import { DonationCard } from '@/components/DonationCard';
import { classNames, sortByPriority, urgencyLevel } from '@/utils/helpers';
import type { LiveOperations, Donation } from '@/types';

export function AdminLiveOperations() {
  const [ops, setOps] = useState<LiveOperations | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [o, d] = await Promise.all([getLiveOperations(), adminFetchDonations()]);
      setOps(o);
      setDonations(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !ops) return <LoadingSpinner label="Loading live operations..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!ops) return <ErrorState message="Could not load operations data." />;

  const activeDonations = donations.filter((d) => !['completed', 'cancelled', 'expired'].includes(d.status));
  const rescueDonations = activeDonations.filter((d) => d.rescue_mode || urgencyLevel(d.expiry_time) === 'rescue');
  const atRiskDonations = activeDonations.filter((d) => {
    const u = urgencyLevel(d.expiry_time);
    return u === 'critical' || u === 'high';
  });
  const sortedActive = sortByPriority(activeDonations);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-600" /> Live Operations
          </h1>
          <p className="text-sm text-gray-500">Real-time view of all active donations and deliveries. Auto-refreshes every 30 seconds.</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Live
        </span>
      </div>

      {/* Alert banners */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ops.rescue_mode > 0 && (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 animate-pulse">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-600" />
              <p className="text-sm font-bold text-red-700">{ops.rescue_mode} donations need rescue</p>
            </div>
          </div>
        )}
        {ops.critical > 0 && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm font-bold text-red-700">{ops.critical} critical (under 30 min)</p>
            </div>
          </div>
        )}
        {ops.at_risk > 0 && (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <p className="text-sm font-bold text-orange-700">{ops.at_risk} pickups at risk</p>
            </div>
          </div>
        )}
        {ops.in_transit > 0 && (
          <div className="rounded-xl border border-purple-300 bg-purple-50 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-500" />
              <p className="text-sm font-bold text-purple-700">{ops.in_transit} deliveries in transit</p>
            </div>
          </div>
        )}
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard title="Active Donations" value={ops.active_donations} icon={<Package className="h-5 w-5" />} color="green" />
        <DashboardCard title="Waiting for NGO" value={ops.waiting_for_ngo} icon={<Search className="h-5 w-5" />} color="blue" />
        <DashboardCard title="Waiting for Volunteer" value={ops.ngo_accepted} icon={<Users className="h-5 w-5" />} color="cyan" />
        <DashboardCard title="Volunteer Assigned" value={ops.volunteer_assigned} icon={<Clock className="h-5 w-5" />} color="amber" />
        <DashboardCard title="Active Pickups" value={ops.volunteer_arrived + ops.food_picked_up} icon={<Package className="h-5 w-5" />} color="teal" />
        <DashboardCard title="In Transit" value={ops.in_transit} icon={<Truck className="h-5 w-5" />} color="purple" />
        <DashboardCard title="Completed Today" value={ops.completed_today} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        <DashboardCard title="Expired Today" value={ops.expired_today} icon={<XCircle className="h-5 w-5" />} color="red" />
      </div>

      {/* Open exceptions */}
      {ops.open_exceptions > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-semibold text-orange-700">{ops.open_exceptions} open delivery exception{ops.open_exceptions !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Active donations sorted by priority */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Donations (by Priority)</h2>
        {sortedActive.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No active donations right now.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedActive.slice(0, 12).map((d) => (
              <DonationCard key={d.id} donation={d} />
            ))}
          </div>
        )}
        {sortedActive.length > 12 && (
          <div className="mt-4 text-center">
            <Link to="/admin/donations" className="text-sm font-medium text-green-600 hover:text-green-700">
              View all {sortedActive.length} active donations →
            </Link>
          </div>
        )}
      </div>

      {/* Rescue & at-risk sections */}
      {rescueDonations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2 mb-3">
            <Siren className="h-5 w-5" /> Rescue Mode Donations
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rescueDonations.map((d) => (
              <DonationCard key={d.id} donation={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
