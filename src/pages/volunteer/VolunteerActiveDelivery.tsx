import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Truck, MapPin, Store, Building2, Package, Users, Phone, User,
  QrCode, CheckCircle2, Navigation, Play, Camera, X, AlertCircle, Clock,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { fetchDelivery, arriveAtRestaurant, verifyPickup, startDelivery, arriveAtNgo } from '@/services/api';
import type { Delivery } from '@/types';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/StatusBadge';
import { CountdownTimer } from '@/components/CountdownTimer';
import { ExceptionForm } from '@/components/ExceptionForm';
import { deliveryStatusBadge, formatDateTime, classNames, urgencyLevel } from '@/utils/helpers';

export function VolunteerActiveDelivery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setDelivery(await fetchDelivery(id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleArriveRestaurant = async () => {
    if (!delivery) return;
    setActing(true);
    try {
      const d = await arriveAtRestaurant(delivery.donation_id);
      updateFromDonation(d);
      toast('Arrival at restaurant recorded.', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setActing(false); }
  };

  const handleVerifyPickup = async (token: string) => {
    if (!delivery || !token.trim()) { toast('Please provide a QR token', 'error'); return; }
    setActing(true);
    try {
      const d = await verifyPickup(delivery.donation_id, token.trim());
      updateFromDonation(d);
      toast('Pickup verified! Food has been collected.', 'success');
      setShowScanner(false);
      setShowManual(false);
      setManualToken('');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setActing(false); }
  };

  const handleStartDelivery = async () => {
    if (!delivery) return;
    setActing(true);
    try {
      const d = await startDelivery(delivery.donation_id);
      updateFromDonation(d);
      toast('Delivery started! Head to the NGO.', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setActing(false); }
  };

  const handleArriveNgo = async () => {
    if (!delivery) return;
    setActing(true);
    try {
      const d = await arriveAtNgo(delivery.donation_id);
      updateFromDonation(d);
      toast('Arrival at NGO recorded. Waiting for NGO confirmation.', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setActing(false); }
  };

  const updateFromDonation = async (donation: any) => {
    // The transition returns the donation row; reload the delivery to get updated status
    await load();
  };

  // QR Scanner
  const startScanner = useCallback(async () => {
    setShowScanner(true);
    setShowManual(false);
    setTimeout(async () => {
      try {
        const html5Qrcode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            html5Qrcode.stop().then(() => {
              setShowScanner(false);
              handleVerifyPickup(decodedText);
            });
          },
          () => {}
        );
      } catch (err: any) {
        toast('Camera access failed. Use manual entry instead.', 'error');
        setShowScanner(false);
        setShowManual(true);
      }
    }, 100);
  }, [delivery]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  if (loading) return <LoadingSpinner label="Loading delivery..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!delivery) return <ErrorState message="Delivery not found" />;

  const badge = deliveryStatusBadge(delivery.status);
  const d = delivery.donation;
  const status = delivery.status;

  const steps = [
    { key: 'accepted', label: 'Task Accepted', done: ['arrived_restaurant','food_picked_up','in_transit','arrived_ngo','completed'].includes(status) || status === 'accepted' },
    { key: 'arrived_restaurant', label: 'Arrived at Restaurant', done: ['food_picked_up','in_transit','arrived_ngo','completed'].includes(status) },
    { key: 'food_picked_up', label: 'Food Picked Up (QR)', done: ['in_transit','arrived_ngo','completed'].includes(status) },
    { key: 'in_transit', label: 'Delivery Started', done: ['arrived_ngo','completed'].includes(status) },
    { key: 'arrived_ngo', label: 'Arrived at NGO', done: status === 'arrived_ngo' || status === 'completed' },
    { key: 'completed', label: 'Completed', done: status === 'completed' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{d?.food_name}</h1>
            <p className="mt-1 text-sm text-gray-500">{d?.category} • {delivery.quantity} {d?.unit}</p>
          </div>
          <StatusBadge label={badge.label} color={badge.color} />
        </div>

        {d?.expiry_time && !['completed', 'cancelled', 'expired'].includes(status) && (
          <div className="mt-4">
            <CountdownTimer expiryTime={d.expiry_time} />
          </div>
        )}

        {/* Progress steps */}
        <div className="mt-6">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div className={classNames(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    s.done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                  )}>
                    {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="mt-1 text-[10px] text-center w-16 text-gray-600">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={classNames('h-0.5 w-8 sm:w-12', s.done ? 'bg-green-600' : 'bg-gray-200')} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pickup info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-green-600" /> Pickup (Restaurant)
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <Row icon={Store} label="Restaurant" value={delivery.restaurant?.name || ''} />
            <Row icon={MapPin} label="Address" value={delivery.pickup_address} />
            <Row icon={Phone} label="Contact" value={`${d?.contact_person || ''} • ${d?.contact_number || ''}`} />
            <Row icon={Clock} label="Pickup Window" value={`${d?.pickup_start_time || ''} - ${d?.pickup_deadline || ''}`} />
            {d?.pickup_instructions && <Row icon={AlertCircle} label="Instructions" value={d.pickup_instructions} />}
          </div>
        </div>

        {/* Drop info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" /> Drop (NGO)
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <Row icon={Building2} label="NGO" value={delivery.ngo?.name || ''} />
            <Row icon={MapPin} label="Address" value={delivery.drop_address} />
            <Row icon={Phone} label="Phone" value={delivery.ngo?.phone || ''} />
            <Row icon={Users} label="Servings" value={`${d?.estimated_servings} people`} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Delivery Timeline</h2>
        <div className="mt-4 space-y-3">
          <TimelineItem label="Task Created" time={delivery.created_at} done />
          {delivery.arrived_at_restaurant && <TimelineItem label="Arrived at Restaurant" time={delivery.arrived_at_restaurant} done />}
          {delivery.picked_up_at && <TimelineItem label="Food Picked Up" time={delivery.picked_up_at} done />}
          {delivery.started_at && <TimelineItem label="Delivery Started" time={delivery.started_at} done />}
          {delivery.arrived_at_ngo && <TimelineItem label="Arrived at NGO" time={delivery.arrived_at_ngo} done />}
          {delivery.completed_at && <TimelineItem label="Completed" time={delivery.completed_at} done />}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Actions</h2>
        <div className="mt-4 space-y-3">
          {status === 'accepted' && (
            <ActionButton onClick={handleArriveRestaurant} disabled={acting} icon={Navigation} label="Arrived at Restaurant" />
          )}
          {status === 'arrived_restaurant' && (
            <>
              <ActionButton onClick={startScanner} disabled={acting} icon={QrCode} label="Scan QR Code" />
              <button onClick={() => { setShowManual(true); setShowScanner(false); }} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Camera not working? Enter token manually
              </button>
            </>
          )}
          {status === 'food_picked_up' && (
            <ActionButton onClick={handleStartDelivery} disabled={acting} icon={Play} label="Start Delivery" />
          )}
          {status === 'in_transit' && (
            <ActionButton onClick={handleArriveNgo} disabled={acting} icon={Navigation} label="Arrived at NGO" />
          )}
          {status === 'arrived_ngo' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-semibold">Waiting for NGO confirmation</p>
              <p className="mt-0.5">The NGO will confirm receipt to complete this delivery.</p>
            </div>
          )}
          {status === 'completed' && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Delivery completed! Thank you for your contribution.
            </div>
          )}

          {/* Exception reporting for active deliveries */}
          {['accepted', 'arrived_restaurant', 'food_picked_up', 'in_transit', 'arrived_ngo'].includes(status) && d && (
            <div className="pt-2">
              <ExceptionForm donationId={delivery.donation_id} expectedQuantity={Number(d.quantity)} unit={d.unit} />
            </div>
          )}
          {status === 'cancelled' && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              This delivery was cancelled.
            </div>
          )}
          {status === 'assigned' && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              This task hasn't been accepted by you yet.
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Camera className="h-5 w-5" /> Scan QR Code
              </h3>
              <button onClick={stopScanner} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-gray-900" />
            <p className="mt-3 text-xs text-gray-500 text-center">Point the camera at the restaurant's QR code.</p>
            <button
              onClick={() => { stopScanner(); setShowManual(true); }}
              className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Enter token manually instead
            </button>
          </div>
        </div>
      )}

      {/* Manual token entry */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Enter QR Token Manually</h3>
              <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Ask the restaurant for the verification token and enter it below.</p>
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste token here"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
            <button
              onClick={() => handleVerifyPickup(manualToken)}
              disabled={acting || !manualToken.trim()}
              className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {acting ? 'Verifying...' : 'Verify Pickup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function TimelineItem({ label, time, done }: { label: string; time: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={classNames('flex h-6 w-6 items-center justify-center rounded-full', done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400')}>
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{formatDateTime(time)}</p>
      </div>
    </div>
  );
}

function ActionButton({ onClick, disabled, icon: Icon, label }: { onClick: () => void; disabled: boolean; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
    >
      <Icon className="h-4 w-4" /> {disabled ? 'Processing...' : label}
    </button>
  );
}
