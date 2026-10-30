import { useEffect, useState } from 'react';
import { fetchDonationEvents, fetchMatchAttempts } from '@/services/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { formatDateTime, classNames } from '@/utils/helpers';
import type { DonationEvent, MatchAttempt, EventType } from '@/types';
import {
  PlusCircle, Handshake, UserCheck, UserX, Bike, MapPin,
  PackageCheck, Truck, Home, CheckCircle2, XCircle,
  AlertTriangle, Siren, RefreshCw, FileWarning,
} from 'lucide-react';

const eventIconMap: Record<EventType, React.ComponentType<{ className?: string }>> = {
  created: PlusCircle,
  ngo_recommended: Handshake,
  ngo_accepted: UserCheck,
  ngo_rejected: UserX,
  volunteer_recommended: Bike,
  volunteer_assigned: UserCheck,
  volunteer_arrived: MapPin,
  pickup_verified: PackageCheck,
  in_transit: Truck,
  delivered: Home,
  completed: CheckCircle2,
  cancelled: XCircle,
  expired: XCircle,
  escalated: AlertTriangle,
  rescue_started: Siren,
  reassigned: RefreshCw,
  exception_reported: FileWarning,
};

const eventColorMap: Record<EventType, string> = {
  created: 'text-gray-500 bg-gray-100',
  ngo_recommended: 'text-blue-600 bg-blue-50',
  ngo_accepted: 'text-green-600 bg-green-50',
  ngo_rejected: 'text-red-600 bg-red-50',
  volunteer_recommended: 'text-cyan-600 bg-cyan-50',
  volunteer_assigned: 'text-indigo-600 bg-indigo-50',
  volunteer_arrived: 'text-amber-600 bg-amber-50',
  pickup_verified: 'text-teal-600 bg-teal-50',
  in_transit: 'text-purple-600 bg-purple-50',
  delivered: 'text-lime-600 bg-lime-50',
  completed: 'text-green-700 bg-green-100',
  cancelled: 'text-red-600 bg-red-50',
  expired: 'text-red-700 bg-red-100',
  escalated: 'text-orange-600 bg-orange-50',
  rescue_started: 'text-red-600 bg-red-50',
  reassigned: 'text-amber-600 bg-amber-50',
  exception_reported: 'text-orange-600 bg-orange-50',
};

const eventLabelMap: Record<EventType, string> = {
  created: 'Donation created',
  ngo_recommended: 'NGO recommended',
  ngo_accepted: 'NGO accepted',
  ngo_rejected: 'NGO rejected',
  volunteer_recommended: 'Volunteer recommended',
  volunteer_assigned: 'Volunteer assigned',
  volunteer_arrived: 'Volunteer arrived at restaurant',
  pickup_verified: 'Pickup verified',
  in_transit: 'Delivery in transit',
  delivered: 'Delivered to NGO',
  completed: 'Donation completed',
  cancelled: 'Donation cancelled',
  expired: 'Donation expired',
  escalated: 'Escalated',
  rescue_started: 'Rescue mode started',
  reassigned: 'Volunteer reassigned',
  exception_reported: 'Exception reported',
};

interface Props {
  donationId: string;
  matchAttempts?: MatchAttempt[];
}

export function DecisionHistory({ donationId }: Props) {
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [attempts, setAttempts] = useState<MatchAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [e, a] = await Promise.all([
        fetchDonationEvents(donationId),
        fetchMatchAttempts(donationId),
      ]);
      setEvents(e);
      setAttempts(a);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [donationId]);

  if (loading) return <LoadingSpinner label="Loading decision history..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (events.length === 0 && attempts.length === 0) {
    return <EmptyState title="No history yet" message="Decision history will appear here as the donation progresses." />;
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      {events.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h4>
          <div className="space-y-3">
            {events.map((event, idx) => {
              const Icon = eventIconMap[event.event_type] || PlusCircle;
              const color = eventColorMap[event.event_type] || 'text-gray-500 bg-gray-100';
              const label = eventLabelMap[event.event_type] || event.event_type;
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={classNames('flex h-8 w-8 items-center justify-center rounded-full', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {idx < events.length - 1 && <div className="w-px h-full bg-gray-200 min-h-[1.5rem]" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(event.created_at)}</p>
                    {event.previous_status && event.new_status && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.previous_status} → {event.new_status}
                      </p>
                    )}
                    {event.reason && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{event.reason}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match attempts */}
      {attempts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recovery Chain — Match Attempts</h4>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Target</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Score</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Outcome</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 capitalize text-gray-700">{a.target_type}</td>
                    <td className="px-3 py-2 text-gray-700">{a.score ?? '—'}%</td>
                    <td className="px-3 py-2">
                      <span className={classNames(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                        a.outcome === 'accepted' ? 'bg-green-100 text-green-700' :
                        a.outcome === 'rejected' ? 'bg-red-100 text-red-700' :
                        a.outcome === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {a.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">{formatDateTime(a.attempted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
