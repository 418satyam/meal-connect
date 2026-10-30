import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { scoreColor, scoreLabel } from '@/utils/helpers';
import { classNames } from '@/utils/helpers';
import type { MatchScore } from '@/types';

interface Props {
  match: MatchScore | null;
  title?: string;
}

export function MatchExplanation({ match, title = 'Why this match?' }: Props) {
  if (!match) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-gray-400" />
          {title}
        </h4>
        <div className={classNames('rounded-lg px-2.5 py-1 text-sm font-bold', scoreColor(match.score))}>
          {match.score}%
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">{scoreLabel(match.score)}</p>
      <div className="mt-3 space-y-1.5">
        {match.reasons?.map((reason, i) => {
          const isNegative = reason.toLowerCase().includes('does not') ||
            reason.toLowerCase().includes('limited') ||
            reason.toLowerCase().includes('high workload') ||
            reason.toLowerCase().includes('little time') ||
            reason.toLowerCase().includes('may not') ||
            reason.toLowerCase().includes('may struggle') ||
            reason.toLowerCase().includes('not accept');
          const Icon = isNegative ? XCircle : CheckCircle2;
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Icon className={classNames('h-4 w-4 mt-0.5 flex-shrink-0', isNegative ? 'text-red-500' : 'text-green-500')} />
              <span className={isNegative ? 'text-gray-600' : 'text-gray-700'}>{reason}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
