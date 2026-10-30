import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Package } from 'lucide-react';
import { adminFetchDonations } from '@/services/api';
import type { Donation } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { donationStatusBadge, formatDate, classNames } from '@/utils/helpers';

const categories = ['All', 'Cooked Meals', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Packaged Food', 'Beverages', 'Other'];
const statuses = ['All', 'waiting_for_ngo', 'ngo_accepted', 'volunteer_assigned', 'volunteer_arrived', 'food_picked_up', 'in_transit', 'delivered', 'completed', 'cancelled'];

export function AdminDonations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setDonations(await adminFetchDonations()); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = donations;
    if (category !== 'All') list = list.filter((d) => d.category === category);
    if (status !== 'All') list = list.filter((d) => d.status === status);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.food_name.toLowerCase().includes(q) || d.restaurant?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [donations, search, category, status]);

  if (loading) return <LoadingSpinner label="Loading donations..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">All Donations</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by food or restaurant..." className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-green-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none">
            {statuses.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No donations found" icon={<Package className="h-8 w-8" />} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Food</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Restaurant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">NGO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Volunteer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const badge = donationStatusBadge(d.status);
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/donations/${d.id}`} className="font-medium text-green-700 hover:text-green-800">{d.food_name}</Link>
                      <p className="text-xs text-gray-500">{d.category}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.restaurant?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.ngo?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.volunteer?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.quantity} {d.unit}</td>
                    <td className="px-4 py-3"><StatusBadge label={badge.label} color={badge.color} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(d.created_at)}</td>
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
