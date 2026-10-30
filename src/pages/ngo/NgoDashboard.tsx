import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, ClipboardList, Truck, CheckCircle2, Users, HeartHandshake, ArrowRight, Search } from 'lucide-react';
import { fetchDonations, fetchDeliveries } from '@/services/api';
import type { Donation, Delivery } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DashboardCard } from '@/components/DashboardCard';
import { DonationCard } from '@/components/DonationCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';

export function NgoDashboard() {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [d, del] = await Promise.all([fetchDonations({ mine: true }), fetchDeliveries({ mine: true })]);
      setDonations(d);
      setDeliveries(del);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const available = donations.filter((d) => d.status === 'waiting_for_ngo');
    const accepted = donations.filter((d) => d.ngo_id === profile?.id && !['completed', 'cancelled'].includes(d.status));
    const activeDel = deliveries.filter((d) => !['completed', 'cancelled'].includes(d.status));
    const completed = deliveries.filter((d) => d.status === 'completed');
    const mealsReceived = completed.reduce((s, d) => s + (d.donation?.estimated_servings || 0), 0);
    const peopleServed = mealsReceived;
    return { available: available.length, accepted: accepted.length, activeDel: activeDel.length, completed: completed.length, mealsReceived, peopleServed };
  }, [donations, deliveries, profile]);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.name}</h1>
        <p className="text-sm text-gray-500">Find food donations and manage deliveries.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard title="Available" value={stats.available} icon={<Package className="h-5 w-5" />} color="blue" />
        <DashboardCard title="Accepted" value={stats.accepted} icon={<ClipboardList className="h-5 w-5" />} color="indigo" />
        <DashboardCard title="Active Deliveries" value={stats.activeDel} icon={<Truck className="h-5 w-5" />} color="amber" />
        <DashboardCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
        <DashboardCard title="Meals Received" value={stats.mealsReceived} icon={<Users className="h-5 w-5" />} color="green" />
        <DashboardCard title="People Served" value={stats.peopleServed} icon={<HeartHandshake className="h-5 w-5" />} color="purple" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Available Donations</h2>
          <Link to="/ngo/discover" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
            Discover all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {donations.filter((d) => d.status === 'waiting_for_ngo').length === 0 ? (
          <EmptyState title="No available donations" message="New donations from restaurants will appear here." icon={<Search className="h-8 w-8" />} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {donations.filter((d) => d.status === 'waiting_for_ngo').slice(0, 6).map((d) => (
              <DonationCard key={d.id} donation={d} actionLabel="Accept" actionTo={`/donations/${d.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
