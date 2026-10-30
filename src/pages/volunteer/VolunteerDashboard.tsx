import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Truck, CheckCircle2, Users, Package, ArrowRight } from 'lucide-react';
import { fetchDeliveries, fetchAvailableDeliveriesForVolunteer, updateVolunteerStatus } from '@/services/api';
import type { Delivery, VolunteerStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { DashboardCard } from '@/components/DashboardCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { deliveryStatusBadge, formatDateTime, classNames } from '@/utils/helpers';

export function VolunteerDashboard() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, available] = await Promise.all([
        fetchDeliveries({ mine: true }),
        fetchAvailableDeliveriesForVolunteer(
          profile?.service_area ?? null,
          profile?.address ?? null,
        ),
      ]);
      setDeliveries(mine);
      setAvailableCount(available.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id]);

  const stats = useMemo(() => {
    const active = deliveries.filter((d) => !['completed', 'cancelled'].includes(d.status));
    const completed = deliveries.filter((d) => d.status === 'completed');
    const mealsDelivered = completed.reduce((s, d) => s + (d.donation?.estimated_servings || 0), 0);
    return { available: availableCount, active: active.length, completed: completed.length, mealsDelivered, total: deliveries.length };
  }, [deliveries, availableCount]);

  const handleStatusChange = async (status: VolunteerStatus) => {
    setStatusSaving(true);
    try {
      await updateVolunteerStatus(status);
      await refreshProfile();
      toast(`You are now ${status}`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const volStatus = profile?.volunteer_status || 'offline';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.name}</h1>
          <p className="text-sm text-gray-500">Find delivery tasks and track your active deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          {(['available', 'busy', 'offline'] as VolunteerStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={statusSaving}
              className={classNames(
                'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                volStatus === s
                  ? s === 'available' ? 'bg-green-600 text-white'
                    : s === 'busy' ? 'bg-amber-600 text-white'
                    : 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                statusSaving && 'opacity-60'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <DashboardCard title="Available Tasks" value={stats.available} icon={<Search className="h-5 w-5" />} color="blue" />
        <DashboardCard title="Active Delivery" value={stats.active} icon={<Truck className="h-5 w-5" />} color="amber" />
        <DashboardCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
        <DashboardCard title="Meals Delivered" value={stats.mealsDelivered} icon={<Users className="h-5 w-5" />} color="green" />
        <DashboardCard title="Total Deliveries" value={stats.total} icon={<Package className="h-5 w-5" />} color="purple" />
      </div>

      {stats.active > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">You have an active delivery</h2>
          <p className="mt-1 text-sm text-amber-700">Continue your delivery to complete the food rescue.</p>
          <Link to="/volunteer/active" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:text-amber-900">
            Go to Active Delivery <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Recent Deliveries</h2>
        {deliveries.length === 0 ? (
          <EmptyState title="No deliveries yet" message="Accept a delivery task to get started." icon={<Truck className="h-8 w-8" />} />
        ) : (
          <div className="space-y-3">
            {deliveries.slice(0, 5).map((d) => {
              const badge = deliveryStatusBadge(d.status);
              return (
                <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-900">{d.donation?.food_name}</p>
                    <p className="text-sm text-gray-500">{d.restaurant?.name} → {d.ngo?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(d.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge label={badge.label} color={badge.color} />
                    <Link to={`/volunteer/delivery/${d.id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
