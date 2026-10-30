import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { fetchDonations } from '@/services/api';
import type { Donation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DonationCard } from '@/components/DonationCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';

export function NgoAccepted() {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await fetchDonations({ mine: true });
      setDonations(all.filter((d) => d.ngo_id === profile?.id && !['completed', 'cancelled'].includes(d.status)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile]);

  if (loading) return <LoadingSpinner label="Loading..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accepted Donations</h1>
        <Link to="/ngo/deliveries" className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700">
          View Deliveries <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {donations.length === 0 ? (
        <EmptyState title="No accepted donations" message="Accept donations from the Discover page to see them here." icon={<ClipboardList className="h-8 w-8" />} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {donations.map((d) => <DonationCard key={d.id} donation={d} />)}
        </div>
      )}
    </div>
  );
}
