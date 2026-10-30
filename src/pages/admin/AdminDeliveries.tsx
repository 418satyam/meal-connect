import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { adminFetchDeliveries } from '@/services/api';
import type { Delivery } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { deliveryStatusBadge, formatDateTime } from '@/utils/helpers';

export function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setDeliveries(await adminFetchDeliveries()); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner label="Loading deliveries..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">All Deliveries</h1>
      {deliveries.length === 0 ? (
        <EmptyState title="No deliveries found" icon={<Truck className="h-8 w-8" />} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Donation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Restaurant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">NGO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Volunteer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((d) => {
                const badge = deliveryStatusBadge(d.status);
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.donation?.food_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.restaurant?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.ngo?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.volunteer?.name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge label={badge.label} color={badge.color} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(d.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.completed_at ? formatDateTime(d.completed_at) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
