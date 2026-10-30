import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, Users, Building2, Store, Package, AlertCircle, Navigation, MapPinned } from 'lucide-react';
import { fetchAvailableDeliveriesForVolunteer, assignVolunteer } from '@/services/api';
import type { Delivery } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { PriorityBadge } from '@/components/PriorityBadge';
import { timeUntilExpiry, urgencyLevel, urgencyColor, classNames } from '@/utils/helpers';

export function VolunteerTasks() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDeliveries(await fetchAvailableDeliveriesForVolunteer(
        profile?.service_area ?? null,
        profile?.address ?? null,
      ));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id]);

  const sorted = [...deliveries].sort((a, b) => {
    const aExpiry = new Date(a.donation?.expiry_time || 0).getTime();
    const bExpiry = new Date(b.donation?.expiry_time || 0).getTime();
    return aExpiry - bExpiry;
  });

  const handleAccept = async (donationId: string, id: string) => {
    setActing(id);
    try {
      await assignVolunteer(donationId);
      toast('Delivery claimed! Redirecting to your active delivery.', 'success');
      load();
      navigate('/volunteer/active');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already been claimed')) {
        toast('This delivery has already been claimed by another volunteer.', 'error');
      } else if (msg.includes('must be available')) {
        toast('You must be available to accept delivery tasks.', 'error');
      } else if (msg.includes('busy')) {
        toast('You are currently busy with another delivery. Complete it first.', 'error');
      } else if (msg.includes('expired')) {
        toast('This donation has expired.', 'error');
      } else {
        toast(msg, 'error');
      }
      load();
    } finally {
      setActing(null);
    }
  };

  if (loading) return <LoadingSpinner label="Loading tasks..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const isOffline = profile?.volunteer_status === 'offline';
  const volArea = profile?.service_area || profile?.address || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Available Tasks</h1>
        <p className="text-sm text-gray-500">
          Delivery tasks in your area{volArea ? ` (${volArea})` : ''}, sorted by urgency.
        </p>
      </div>

      {isOffline && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>You are currently offline. Go to your Profile to set yourself as Available to claim delivery tasks.</span>
        </div>
      )}

      {!isOffline && !volArea && sorted.length === 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex items-center gap-2">
          <MapPinned className="h-5 w-5 flex-shrink-0" />
          <span>Set your address or service area in your Profile to see delivery tasks near you.</span>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="No available tasks in your area"
          message="When NGOs accept donations near your location, delivery tasks will appear here."
          icon={<Search className="h-8 w-8" />}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sorted.map((d) => {
            const urgency = d.donation ? urgencyLevel(d.donation.expiry_time) : 'normal';
            return (
              <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.donation?.food_name}</h3>
                    <p className="text-sm text-gray-500">{d.donation?.category} • {d.donation?.food_type}</p>
                  </div>
                  <PriorityBadge priority={urgency} />
                </div>

                {d.donation && (
                  <div className={classNames('mt-2 text-sm font-medium', urgencyColor(urgency))}>
                    {timeUntilExpiry(d.donation.expiry_time)}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
                  <Package className="h-4 w-4 text-gray-400" /> {d.quantity} {d.donation?.unit}
                  <span className="text-gray-300 mx-1">•</span>
                  <Users className="h-4 w-4 text-gray-400" /> {d.donation?.estimated_servings} servings
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Store className="h-4 w-4 text-green-600 flex-shrink-0" /> {d.restaurant?.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" /> Pick: {d.pickup_address}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" /> Drop: {d.ngo?.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" /> {d.drop_address}
                  </div>
                  {d.ngo?.service_area && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <MapPinned className="h-4 w-4 text-blue-400 flex-shrink-0" /> Area: {d.ngo.service_area}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" /> Pickup by: {d.donation?.pickup_deadline}
                  </div>
                  {d.donation?.storage_requirements && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Package className="h-4 w-4 text-gray-400 flex-shrink-0" /> Storage: {d.donation.storage_requirements}
                    </div>
                  )}
                  {d.donation?.pickup_instructions && (
                    <div className="flex items-start gap-1.5 text-gray-600">
                      <Navigation className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" /> {d.donation.pickup_instructions}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleAccept(d.donation_id, d.id)}
                    disabled={acting === d.id || isOffline}
                    className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {acting === d.id ? 'Claiming...' : 'Accept Delivery'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
