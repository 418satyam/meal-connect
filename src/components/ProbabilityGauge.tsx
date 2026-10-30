import { classNames, probabilityColor, probabilityLabel } from '@/utils/helpers';
import { TrendingUp, Info } from 'lucide-react';
import type { SuccessProbability } from '@/types';

interface Props {
  probability: SuccessProbability | null;
}

export function ProbabilityGauge({ probability }: Props) {
  if (!probability) return null;
  const color = probabilityColor(probability.probability);
  const label = probabilityLabel(probability.probability);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h4 className="text-sm font-semibold text-gray-900">Success Probability</h4>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={classNames('text-3xl font-bold', color)}>
          {probability.probability}%
        </span>
        <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      </div>
      <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
        <div
          className={classNames('h-2 rounded-full transition-all',
            probability.probability >= 70 ? 'bg-green-500' :
            probability.probability >= 50 ? 'bg-amber-500' :
            probability.probability >= 30 ? 'bg-orange-500' : 'bg-red-500')}
          style={{ width: `${probability.probability}%` }}
        />
      </div>
      {probability.factors.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <Info className="h-3 w-3" /> Contributing factors:
          </p>
          <div className="mt-2 space-y-1.5">
            {probability.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400 italic">
        This is a decision-support estimate, not a guarantee.
      </p>
    </div>
  );
}
