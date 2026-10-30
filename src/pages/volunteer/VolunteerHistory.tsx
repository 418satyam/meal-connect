import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Truck } from 'lucide-react';
import { fetchDeliveries } from '@/services/api';
import type { Delivery } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { deliveryStatusBadge, formatDateTime } from '@/utils/helpers';

export function VolunteerHistory() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await fetchDeliveries({ mine: true });
      setDeliveries(all.filter((d) => ['completed', 'cancelled'].includes(d.status)));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner label="Loading history..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Delivery History</h1>
      {deliveries.length === 0 ? (
        <EmptyState title="No delivery history" message="Your completed and cancelled deliveries will appear here." icon={<History className="h-8 w-8" />} />
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => {
            const badge = deliveryStatusBadge(d.status);
            return (
              <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{d.donation?.food_name}</p>
                  <p className="text-sm text-gray-500">{d.restaurant?.name} → {d.ngo?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(d.completed_at || d.created_at)}</p>
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
  );
}
