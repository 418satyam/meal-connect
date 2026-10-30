import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle2, Users, Scale, PlusCircle, ArrowRight } from 'lucide-react';
import { fetchDonations } from '@/services/api';
import type { Donation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DashboardCard } from '@/components/DashboardCard';
import { DonationCard } from '@/components/DonationCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';

export function RestaurantDashboard() {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchDonations();
      setDonations(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = donations.filter((d) => !['completed', 'cancelled', 'expired'].includes(d.status));
    const completed = donations.filter((d) => d.status === 'completed');
    const meals = completed.reduce((s, d) => s + d.estimated_servings, 0);
    const foodRescued = completed.reduce((s, d) => s + Number(d.quantity), 0);
    return { total: donations.length, active: active.length, completed: completed.length, meals, foodRescued };
  }, [donations]);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.name}</h1>
          <p className="text-sm text-gray-500">Here's your donation overview.</p>
        </div>
        <Link
          to="/restaurant/create"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <PlusCircle className="h-4 w-4" /> Create Donation
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <DashboardCard title="Total Donations" value={stats.total} icon={<Package className="h-5 w-5" />} color="green" />
        <DashboardCard title="Active" value={stats.active} icon={<Clock className="h-5 w-5" />} color="amber" />
        <DashboardCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
        <DashboardCard title="Meals Donated" value={stats.meals} icon={<Users className="h-5 w-5" />} color="blue" />
        <DashboardCard title="Food Rescued" value={`${stats.foodRescued}`} subtitle="total units" icon={<Scale className="h-5 w-5" />} color="purple" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Donations</h2>
          <Link to="/restaurant/donations" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {donations.length === 0 ? (
          <EmptyState
            title="No donations yet"
            message="Create your first food donation to start helping your community."
            action={
              <Link to="/restaurant/create" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Create Donation
              </Link>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {donations.slice(0, 6).map((d) => <DonationCard key={d.id} donation={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
