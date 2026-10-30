import { AlertTriangle, Clock, Package, MapPin } from 'lucide-react';
import { classNames, timeUntilExpiry, minutesUntilExpiry, formatNumber } from '@/utils/helpers';
import type { Donation } from '@/types';

interface Props {
  donation: Donation;
  bestNgo?: { name: string; score: number } | null;
  bestVolunteer?: { name: string; score: number } | null;
}

export function RescueBanner({ donation, bestNgo, bestVolunteer }: Props) {
  const mins = minutesUntilExpiry(donation.expiry_time);
  const isExpired = mins <= 0;

  return (
    <div className={classNames(
      'rounded-xl border-2 p-5',
      isExpired ? 'border-red-800 bg-red-900' : 'border-red-500 bg-red-50'
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={classNames('h-6 w-6', isExpired ? 'text-red-300' : 'text-red-600 animate-pulse')} />
        <h3 className={classNames('text-lg font-bold', isExpired ? 'text-red-100' : 'text-red-700')}>
          {isExpired ? 'DONATION EXPIRED' : 'FOOD RESCUE MODE'}
        </h3>
      </div>
      {!isExpired && (
        <p className="mt-2 text-sm font-medium text-red-700">
          {formatNumber(donation.estimated_servings)} meals may be wasted in {timeUntilExpiry(donation.expiry_time)}.
        </p>
      )}
      {isExpired && (
        <p className="mt-2 text-sm font-medium text-red-200">
          {formatNumber(donation.estimated_servings)} meals were not rescued in time.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <RescueStat icon={Clock} label="Time Left" value={timeUntilExpiry(donation.expiry_time)} />
        <RescueStat icon={Package} label="Quantity" value={`${formatNumber(Number(donation.quantity))} ${donation.unit}`} />
        <RescueStat icon={MapPin} label="Location" value={donation.pickup_address.slice(0, 30) + '...'} />
        <RescueStat icon={AlertTriangle} label="Escalations" value={String(donation.escalation_count ?? 0)} />
      </div>
      {(bestNgo || bestVolunteer) && !isExpired && (
        <div className="mt-4 rounded-lg bg-white/60 p-3 text-sm">
          <p className="font-semibold text-red-800">Best available matches:</p>
          {bestNgo && <p className="mt-1 text-red-700">NGO: {bestNgo.name} ({bestNgo.score}% match)</p>}
          {bestVolunteer && <p className="text-red-700">Volunteer: {bestVolunteer.name} ({bestVolunteer.score}% match)</p>}
        </div>
      )}
    </div>
  );
}

function RescueStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 p-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-red-500" />
        <p className="text-xs font-medium text-red-600">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-red-900">{value}</p>
    </div>
  );
}
