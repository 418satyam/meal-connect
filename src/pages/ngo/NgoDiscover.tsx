import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, MapPinned, CheckCircle2 } from 'lucide-react';
import { fetchDonations } from '@/services/api';
import type { Donation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DonationCard } from '@/components/DonationCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { sortByPriority, ngoDonationLocationMatch, classNames } from '@/utils/helpers';

const categories = ['All', 'Cooked Meals', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Packaged Food', 'Beverages', 'Other'];
const foodTypes = ['All', 'Vegetarian', 'Non-Vegetarian', 'Vegan'];

export function NgoDiscover() {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [foodType, setFoodType] = useState('All');

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

  const ngoArea = profile?.service_area ?? null;

  const filtered = useMemo(() => {
    let list = donations.filter((d) => d.status === 'waiting_for_ngo');
    if (category !== 'All') list = list.filter((d) => d.category === category);
    if (foodType !== 'All') list = list.filter((d) => d.food_type === foodType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.food_name.toLowerCase().includes(q) ||
        d.restaurant?.name?.toLowerCase().includes(q) ||
        d.pickup_address.toLowerCase().includes(q)
      );
    }
    const sorted = sortByPriority(list);
    // Sort: in-area donations first, then by urgency
    return sorted.sort((a, b) => {
      const aMatch = ngoDonationLocationMatch(ngoArea, a.pickup_address, a.restaurant?.address ?? null).match;
      const bMatch = ngoDonationLocationMatch(ngoArea, b.pickup_address, b.restaurant?.address ?? null).match;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [donations, search, category, foodType, ngoArea]);

  if (loading) return <LoadingSpinner label="Loading donations..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const inAreaCount = filtered.filter((d) =>
    ngoDonationLocationMatch(ngoArea, d.pickup_address, d.restaurant?.address ?? null).match
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discover Donations</h1>
        <p className="text-sm text-gray-500">
          {ngoArea
            ? `Donations near ${ngoArea}, sorted by location match and urgency.`
            : 'Available food donations, sorted by urgency. Set your service area in Profile for location-based matching.'}
        </p>
      </div>

      {ngoArea && filtered.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800 flex items-center gap-2">
          <MapPinned className="h-4 w-4 flex-shrink-0" />
          <span>{inAreaCount} donation{inAreaCount !== 1 ? 's' : ''} in your service area ({ngoArea})</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by food, restaurant, or area..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Filter className="h-4 w-4 text-gray-400 mt-1.5" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 outline-none">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={foodType} onChange={(e) => setFoodType(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 outline-none">
            {foodTypes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No donations found" message="Try changing your filters or check back later for new donations." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => {
            const locMatch = ngoDonationLocationMatch(ngoArea, d.pickup_address, d.restaurant?.address ?? null);
            return (
              <div key={d.id} className="relative">
                {ngoArea && locMatch.match && (
                  <div className="absolute -top-2 -right-2 z-10 rounded-full bg-green-600 text-white text-xs font-semibold px-2.5 py-1 flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> In your area
                  </div>
                )}
                <DonationCard donation={d} actionLabel="Accept" actionTo={`/donations/${d.id}`} />
                {ngoArea && !locMatch.match && (
                  <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                    <MapPinned className="h-3 w-3" /> {locMatch.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
