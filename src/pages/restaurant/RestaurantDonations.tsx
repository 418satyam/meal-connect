import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search } from 'lucide-react';
import { fetchDonations } from '@/services/api';
import type { Donation, DonationStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DonationCard } from '@/components/DonationCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { sortByPriority } from '@/utils/helpers';

interface Props {
  filter?: 'active' | 'history' | 'all';
  title?: string;
}

export function RestaurantDonations({ filter = 'all', title }: Props) {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDonations(await fetchDonations());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = donations;
    if (filter === 'active') {
      list = list.filter((d) => !['completed', 'cancelled', 'expired'].includes(d.status));
    } else if (filter === 'history') {
      list = list.filter((d) => ['completed', 'cancelled', 'expired'].includes(d.status));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.food_name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    }
    return sortByPriority(list);
  }, [donations, filter, search]);

  const heading = title || (filter === 'active' ? 'Active Donations' : filter === 'history' ? 'Donation History' : 'My Donations');

  if (loading) return <LoadingSpinner label="Loading donations..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
        {profile?.role === 'restaurant' && (
          <Link to="/restaurant/create" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <PlusCircle className="h-4 w-4" /> Create Donation
          </Link>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by food name or category..."
          className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching donations" : "No donations here yet"}
          message={search ? "Try a different search term." : "Donations you create will appear here."}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => <DonationCard key={d.id} donation={d} />)}
        </div>
      )}
    </div>
  );
}
