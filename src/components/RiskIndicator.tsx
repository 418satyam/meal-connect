import { classNames, riskColor } from '@/utils/helpers';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { PickupRisk } from '@/types';

interface Props {
  risk: PickupRisk | null;
}

export function RiskIndicator({ risk }: Props) {
  if (!risk) return null;
  const isHigh = risk.level === 'HIGH' || risk.level === 'CRITICAL';
  const Icon = risk.level === 'LOW' ? ShieldCheck : AlertTriangle;
  return (
    <div className={classNames('rounded-lg border px-4 py-3', riskColor(risk.level))}>
      <div className="flex items-center gap-2">
        <Icon className={classNames('h-5 w-5', isHigh && 'animate-pulse')} />
        <div>
          <p className="text-sm font-bold">Pickup Risk: {risk.level}</p>
          <p className="text-xs mt-0.5 opacity-90">{risk.reason}</p>
        </div>
      </div>
    </div>
  );
}
