import { Link } from 'react-router-dom';
import { Clock, MapPin, Users, Package } from 'lucide-react';
import type { Donation } from '@/types';
import { donationStatusBadge, formatDateTime, classNames, urgencyLevel, timeUntilExpiry, urgencyColor } from '@/utils/helpers';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

interface Props {
  donation: Donation;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  compact?: boolean;
}

export function DonationCard({ donation, actionLabel, actionTo, onAction, actionDisabled, compact }: Props) {
  const badge = donationStatusBadge(donation.status);
  const expired = new Date(donation.expiry_time) < new Date();
  const isActive = !['completed', 'cancelled', 'expired'].includes(donation.status);
  const urgency = urgencyLevel(donation.expiry_time);
  const isUrgent = urgency === 'critical' || urgency === 'rescue' || urgency === 'high';

  return (
    <div className={classNames(
      'rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col',
      urgency === 'rescue' ? 'border-red-300 ring-1 ring-red-200' :
      urgency === 'critical' ? 'border-red-200' :
      urgency === 'high' ? 'border-orange-200' : 'border-gray-200'
    )}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{donation.food_name}</h3>
          <p className="text-sm text-gray-500">
            {donation.category} • {donation.food_type}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isActive && <PriorityBadge priority={urgency} />}
          <StatusBadge label={badge.label} color={badge.color} />
        </div>
      </div>

      {!compact && donation.description && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{donation.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Package className="h-4 w-4 text-gray-400" />
          <span>{donation.quantity} {donation.unit}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users className="h-4 w-4 text-gray-400" />
          <span>{donation.estimated_servings} servings</span>
        </div>
        {donation.restaurant && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="truncate">{donation.restaurant.name}</span>
          </div>
        )}
        <div className={classNames('flex items-center gap-1.5', expired ? 'text-red-600 font-semibold' : urgencyColor(urgency))}>
          <Clock className={classNames('h-4 w-4', urgency === 'rescue' && 'animate-pulse')} />
          <span className="truncate">
            {isActive ? timeUntilExpiry(donation.expiry_time) : `Exp ${formatDateTime(donation.expiry_time)}`}
          </span>
        </div>
      </div>

      {donation.rescue_mode && isActive && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 animate-pulse">
          🚨 RESCUE MODE — {donation.estimated_servings} meals at risk
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link
          to={`/donations/${donation.id}`}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View Details
        </Link>
        {actionLabel && (actionTo ? (
          <Link
            to={actionTo}
            className={classNames(
              'flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white',
              actionDisabled ? 'bg-gray-300 cursor-not-allowed' :
              isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            disabled={actionDisabled}
            className={classNames(
              'flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white',
              actionDisabled ? 'bg-gray-300 cursor-not-allowed' :
              isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {actionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
