import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, Clock, MapPin, User, Phone, Calendar,
  AlertTriangle, ShieldCheck, CheckCircle2, Truck, QrCode, XCircle,
  History as HistoryIcon, TrendingUp, RefreshCw, XOctagon, Gauge,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchDonation, acceptDonation, cancelDonation, getPickupRisk,
  getSuccessProbability, triggerRescueMode, cancelVolunteerAssignment,
  ngoRejectDonation, getVolunteerReliability,
} from '@/services/api';
import type { Donation, PickupRisk, SuccessProbability, ReliabilityScore } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RiskIndicator } from '@/components/RiskIndicator';
import { ProbabilityGauge } from '@/components/ProbabilityGauge';
import { RescueBanner } from '@/components/RescueBanner';
import { CountdownTimer } from '@/components/CountdownTimer';
import { PriorityBadge } from '@/components/PriorityBadge';
import { ReliabilityCard } from '@/components/ReliabilityCard';
import { DecisionHistory } from '@/components/DecisionHistory';
import { ExceptionForm } from '@/components/ExceptionForm';
import { donationStatusBadge, formatDateTime, formatDate, classNames, urgencyLevel } from '@/utils/helpers';

export function DonationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showVolCancel, setShowVolCancel] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [volCancelReason, setVolCancelReason] = useState('');
  const [risk, setRisk] = useState<PickupRisk | null>(null);
  const [probability, setProbability] = useState<SuccessProbability | null>(null);
  const [reliability, setReliability] = useState<ReliabilityScore | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const d = await fetchDonation(id);
      setDonation(d);
      if (d && !['completed', 'cancelled', 'expired'].includes(d.status)) {
        try {
          const [r, p] = await Promise.all([
            getPickupRisk(d.id),
            getSuccessProbability(d.id),
          ]);
          setRisk(r);
          setProbability(p);
        } catch { /* non-critical */ }
        if (d.volunteer_id) {
          try {
            setReliability(await getVolunteerReliability(d.volunteer_id));
          } catch { /* non-critical */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAccept = async () => {
    if (!donation) return;
    setActing(true);
    try {
      const d = await acceptDonation(donation.id);
      setDonation(d);
      toast('Donation accepted! A delivery task has been created.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setActing(false); }
  };

  const handleCancel = async () => {
    if (!donation) return;
    setActing(true);
    try {
      const d = await cancelDonation(donation.id);
      setDonation(d);
      toast('Donation cancelled.', 'info');
      setShowCancel(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setActing(false); }
  };

  const handleRescue = async () => {
    if (!donation) return;
    setActing(true);
    try {
      const d = await triggerRescueMode(donation.id);
      setDonation(d);
      toast('Rescue mode activated. Nearby NGOs and volunteers have been notified.', 'warning');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setActing(false); }
  };

  const handleNgoReject = async () => {
    if (!donation || !rejectReason.trim()) {
      toast('Please provide a reason for rejecting.', 'error');
      return;
    }
    setActing(true);
    try {
      const d = await ngoRejectDonation(donation.id, rejectReason);
      setDonation(d);
      toast('Donation rejected. Meal Connect is searching for another organization.', 'warning');
      setShowReject(false);
      setRejectReason('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setActing(false); }
  };

  const handleVolCancel = async () => {
    if (!donation || !volCancelReason.trim()) {
      toast('Please provide a reason for cancellation.', 'error');
      return;
    }
    setActing(true);
    try {
      const d = await cancelVolunteerAssignment(donation.id, volCancelReason);
      setDonation(d);
      toast('Volunteer assignment cancelled. Finding a replacement volunteer...', 'warning');
      setShowVolCancel(false);
      setVolCancelReason('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setActing(false); }
  };

  if (loading) return <LoadingSpinner label="Loading donation..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!donation) return <ErrorState message="Donation not found" />;

  const badge = donationStatusBadge(donation.status);
  const canAccept = profile?.role === 'ngo' && donation.status === 'waiting_for_ngo' && !donation.ngo_id;
  const canCancel = profile?.role === 'restaurant' && donation.restaurant_id === profile.id && !['completed', 'cancelled', 'delivered'].includes(donation.status);
  const showQR = profile?.role === 'restaurant' && donation.qr_token && donation.status !== 'completed' && donation.status !== 'cancelled';
  const canReject = profile?.role === 'ngo' && donation.ngo_id === profile.id && ['ngo_accepted', 'volunteer_assigned'].includes(donation.status);
  const canCancelVolunteer = profile?.role === 'volunteer' && donation.volunteer_id === profile.id && ['volunteer_assigned', 'volunteer_arrived'].includes(donation.status);
  const canTriggerRescue = profile?.role === 'admin' && !['completed', 'cancelled', 'expired'].includes(donation.status);
  const urgency = urgencyLevel(donation.expiry_time);
  const isActive = !['completed', 'cancelled', 'expired'].includes(donation.status);

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Rescue banner for urgent/expired */}
      {(donation.rescue_mode || urgency === 'rescue' || urgency === 'expired') && isActive || donation.status === 'expired' ? (
        <div className="mb-6">
          <RescueBanner donation={donation} />
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{donation.food_name}</h1>
                <p className="mt-1 text-sm text-gray-500">{donation.category} • {donation.food_type}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isActive && <PriorityBadge priority={urgency} />}
                <StatusBadge label={badge.label} color={badge.color} />
              </div>
            </div>
            {isActive && (
              <div className="mt-3">
                <CountdownTimer expiryTime={donation.expiry_time} />
              </div>
            )}
            {donation.description && <p className="mt-4 text-sm text-gray-600">{donation.description}</p>}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <InfoItem icon={Package} label="Quantity" value={`${donation.quantity} ${donation.unit}`} />
              <InfoItem icon={User} label="Servings" value={`${donation.estimated_servings} people`} />
              <InfoItem icon={Calendar} label="Pickup Date" value={formatDate(donation.pickup_date)} />
              <InfoItem icon={Clock} label="Prepared" value={formatDateTime(donation.preparation_time)} />
              <InfoItem icon={Clock} label="Expires" value={formatDateTime(donation.expiry_time)} />
              <InfoItem icon={Clock} label="Pickup Window" value={`${donation.pickup_start_time} - ${donation.pickup_deadline}`} />
            </div>
          </div>

          {/* Pickup Risk Indicator */}
          {isActive && risk && (
            <RiskIndicator risk={risk} />
          )}

          {/* Pickup info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Pickup Information</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
              <InfoItem icon={MapPin} label="Pickup Address" value={donation.pickup_address} />
              <InfoItem icon={User} label="Contact Person" value={donation.contact_person} />
              <InfoItem icon={Phone} label="Contact Number" value={donation.contact_number} />
              {donation.pickup_instructions && (
                <InfoItem icon={AlertTriangle} label="Instructions" value={donation.pickup_instructions} />
              )}
            </div>
          </div>

          {/* Food details */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Food Details</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
              {donation.packaging && <InfoItem icon={Package} label="Packaging" value={donation.packaging} />}
              {donation.allergens && <InfoItem icon={AlertTriangle} label="Allergens" value={donation.allergens} />}
              {donation.storage_requirements && <InfoItem icon={ShieldCheck} label="Storage" value={donation.storage_requirements} />}
              {donation.food_condition && <InfoItem icon={CheckCircle2} label="Condition" value={donation.food_condition} />}
            </div>
          </div>

          {/* Success Probability */}
          {isActive && probability && (
            <ProbabilityGauge probability={probability} />
          )}

          {/* Decision History */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-gray-400" /> Decision History
              </h2>
              <span className="text-sm text-gray-400">{showHistory ? 'Hide' : 'Show'}</span>
            </button>
            {showHistory && (
              <div className="mt-4">
                <DecisionHistory donationId={donation.id} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Parties */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Parties</h2>
            <div className="mt-4 space-y-3">
              {donation.restaurant && <PartyRow label="Restaurant" name={donation.restaurant.name} address={donation.restaurant.address} />}
              {donation.ngo && <PartyRow label="NGO" name={donation.ngo.name} address={donation.ngo.address} />}
              {donation.volunteer && <PartyRow label="Volunteer" name={donation.volunteer.name} address={donation.volunteer.address} />}
            </div>
          </div>

          {/* Volunteer Reliability */}
          {donation.volunteer_id && reliability && (
            <ReliabilityCard reliability={reliability} />
          )}

          {/* QR Code */}
          {showQR && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
              <h2 className="font-semibold text-gray-900 flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5" /> Pickup QR Code
              </h2>
              <p className="mt-1 text-xs text-gray-500">Show this to the volunteer at pickup.</p>
              <div className="mt-4 flex justify-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={donation.qr_token!} size={180} />
              </div>
              {donation.qr_used && (
                <p className="mt-2 text-xs font-medium text-green-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Token used — pickup verified
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            {canAccept && (
              <button
                onClick={handleAccept}
                disabled={acting}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {acting ? 'Accepting...' : 'Accept Donation'}
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowReject(true)}
                disabled={acting}
                className="w-full rounded-lg border border-orange-200 px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50"
              >
                Reject Donation
              </button>
            )}
            {canCancelVolunteer && (
              <button
                onClick={() => setShowVolCancel(true)}
                disabled={acting}
                className="w-full rounded-lg border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-600 hover:bg-amber-50"
              >
                Cancel My Assignment
              </button>
            )}
            {canTriggerRescue && (
              <button
                onClick={handleRescue}
                disabled={acting}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <AlertTriangle className="h-4 w-4" />
                {acting ? 'Activating...' : 'Trigger Rescue Mode'}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancel(true)}
                className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Cancel Donation
              </button>
            )}
            {donation.status === 'ngo_accepted' && profile?.role === 'volunteer' && (
              <Link
                to={`/volunteer/tasks`}
                className="block w-full rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-green-700"
              >
                Go to Tasks
              </Link>
            )}
            {donation.volunteer_id && donation.status !== 'waiting_for_ngo' && donation.status !== 'ngo_accepted' && (
              <Link
                to={`/deliveries`}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Truck className="h-4 w-4" /> View Delivery
              </Link>
            )}
            {/* Exception reporting for active deliveries */}
            {profile && ['restaurant', 'ngo', 'volunteer', 'admin'].includes(profile.role) &&
             ['volunteer_assigned', 'volunteer_arrived', 'food_picked_up', 'in_transit', 'delivered'].includes(donation.status) && (
              <ExceptionForm donationId={donation.id} expectedQuantity={Number(donation.quantity)} unit={donation.unit} />
            )}
            {donation.status === 'completed' && donation.received_quantity != null && (
              <div className="rounded-lg bg-green-50 p-4 text-sm">
                <p className="font-semibold text-green-800">Receipt Confirmed</p>
                <p className="mt-1 text-green-700">Received: {donation.received_quantity} {donation.unit}</p>
                {donation.receipt_notes && <p className="mt-1 text-green-700">Notes: {donation.receipt_notes}</p>}
              </div>
            )}
            {donation.reassignment_count && donation.reassignment_count > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Volunteer reassigned {donation.reassignment_count} time{donation.reassignment_count !== 1 ? 's' : ''}
              </div>
            )}
            {donation.escalation_count && donation.escalation_count > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Escalated {donation.escalation_count} time{donation.escalation_count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Donation Modal */}
      <ConfirmModal
        open={showCancel}
        title="Cancel Donation?"
        message="This will cancel the donation and notify the NGO and volunteer if assigned. This cannot be undone."
        confirmLabel="Yes, Cancel"
        danger
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />

      {/* NGO Reject Modal */}
      <ConfirmModal
        open={showReject}
        title="Reject Donation?"
        confirmLabel={acting ? 'Rejecting...' : 'Reject & Find Next NGO'}
        danger
        onConfirm={handleNgoReject}
        onCancel={() => { setShowReject(false); setRejectReason(''); }}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Meal Connect will automatically search for another organization to accept this donation.</p>
          <div>
            <label className="text-xs font-medium text-gray-500">Reason (required)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Capacity full, cannot accept this food type..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Volunteer Cancel Modal */}
      <ConfirmModal
        open={showVolCancel}
        title="Cancel Your Assignment?"
        confirmLabel={acting ? 'Cancelling...' : 'Cancel & Find Replacement'}
        danger
        onConfirm={handleVolCancel}
        onCancel={() => { setShowVolCancel(false); setVolCancelReason(''); }}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Meal Connect will automatically find a replacement volunteer for this donation.</p>
          <div>
            <label className="text-xs font-medium text-gray-500">Reason (required)</label>
            <textarea
              value={volCancelReason}
              onChange={(e) => setVolCancelReason(e.target.value)}
              rows={3}
              placeholder="e.g. Vehicle breakdown, personal emergency..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-center gap-1.5 text-gray-900">
        <Icon className="h-4 w-4 text-gray-400" />
        <span>{value}</span>
      </div>
    </div>
  );
}

function PartyRow({ label, name, address }: { label: string; name: string; address?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-400 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{name}</p>
      {address && <p className="mt-0.5 text-xs text-gray-500">{address}</p>}
    </div>
  );
}
