import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, MapPin, Package, CheckCircle2, Clock, Store, Building2, User, Navigation } from 'lucide-react';
import { fetchDeliveries, confirmReceipt } from '@/services/api';
import type { Delivery } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { deliveryStatusBadge, formatDateTime, classNames } from '@/utils/helpers';

export function NgoDeliveries() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState<Delivery | null>(null);
  const [receivedQty, setReceivedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDeliveries(await fetchDeliveries({ mine: true }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleConfirm = async () => {
    if (!confirmDel) return;
    setActing(true);
    try {
      await confirmReceipt(confirmDel.donation_id, receivedQty ? Number(receivedQty) : undefined, notes);
      toast('Receipt confirmed! Donation completed.', 'success');
      setConfirmDel(null);
      setReceivedQty('');
      setNotes('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading deliveries..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
      {deliveries.length === 0 ? (
        <EmptyState title="No deliveries yet" message="Deliveries for donations you've accepted will appear here." icon={<Truck className="h-8 w-8" />} />
      ) : (
        <div className="space-y-4">
          {deliveries.map((d) => {
            const badge = deliveryStatusBadge(d.status);
            const canConfirm = profile?.role === 'ngo' && d.status === 'arrived_ngo';
            return (
              <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.donation?.food_name}</h3>
                    <p className="text-sm text-gray-500">{d.donation?.category} • {d.quantity} {d.donation?.unit}</p>
                  </div>
                  <StatusBadge label={badge.label} color={badge.color} />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                      <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-1">
                        <Store className="h-3.5 w-3.5" /> Pickup (Restaurant)
                      </p>
                      <p className="text-gray-700 font-medium">{d.restaurant?.name}</p>
                      <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {d.pickup_address}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1">
                        <Building2 className="h-3.5 w-3.5" /> Drop (NGO)
                      </p>
                      <p className="text-gray-700 font-medium">{d.ngo?.name}</p>
                      <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                        <Navigation className="h-3.5 w-3.5" /> {d.drop_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-gray-400" /> {d.quantity} {d.donation?.unit}
                    </span>
                    <span className={classNames('flex items-center gap-1.5', d.volunteer ? 'text-indigo-600 font-medium' : 'text-gray-400')}>
                      <User className="h-4 w-4" />
                      {d.volunteer?.name ? d.volunteer.name : 'No volunteer assigned yet'}
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="h-4 w-4" /> {formatDateTime(d.created_at)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Link to={`/donations/${d.donation_id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    View Donation
                  </Link>
                  {canConfirm && (
                    <button
                      onClick={() => setConfirmDel(d)}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Confirm Receipt
                    </button>
                  )}
                  {d.status === 'completed' && d.completed_at && (
                    <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Completed {formatDateTime(d.completed_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        title="Confirm Receipt"
        confirmLabel={acting ? 'Confirming...' : 'Confirm Receipt'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmDel(null); setReceivedQty(''); setNotes(''); }}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Confirm you've received the food from the volunteer.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Received Quantity (optional)</label>
            <input
              type="number"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              placeholder={confirmDel?.quantity?.toString() || ''}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
