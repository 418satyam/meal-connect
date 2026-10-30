import { classNames, reliabilityColor } from '@/utils/helpers';
import { TrendingUp, Award } from 'lucide-react';
import type { ReliabilityScore } from '@/types';

interface Props {
  reliability: ReliabilityScore | null;
  compact?: boolean;
}

export function ReliabilityCard({ reliability, compact = false }: Props) {
  if (!reliability) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-400">No reliability data yet</p>
      </div>
    );
  }

  if (reliability.score === null) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Volunteer Reliability</h4>
        </div>
        <p className="mt-2 text-sm text-gray-500">{reliability.label}</p>
        {!compact && <p className="mt-1 text-xs text-gray-400">Score will appear after completing deliveries.</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-green-600" />
          <h4 className="text-sm font-semibold text-gray-900">Volunteer Reliability</h4>
        </div>
        {reliability.score >= 90 && <TrendingUp className="h-4 w-4 text-green-500" />}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={classNames('text-3xl font-bold', reliabilityColor(reliability.score))}>
          {reliability.score}%
        </span>
        <span className="text-sm font-medium text-gray-500 mb-1">{reliability.label}</span>
      </div>
      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <StatRow label="On-time pickup" value={reliability.on_time_rate !== null ? `${reliability.on_time_rate}%` : '—'} />
          <StatRow label="Completion rate" value={reliability.completion_rate !== null ? `${reliability.completion_rate}%` : '—'} />
          <StatRow label="Cancellation rate" value={reliability.cancel_rate !== null ? `${reliability.cancel_rate}%` : '—'} />
          <StatRow label="Avg response" value={reliability.avg_response_minutes !== null ? `${reliability.avg_response_minutes} min` : '—'} />
        </div>
      )}
      {!compact && reliability.total_deliveries > 0 && (
        <p className="mt-3 text-xs text-gray-400">Based on {reliability.total_deliveries} delivery record{reliability.total_deliveries !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
