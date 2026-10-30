import { useEffect, useState } from 'react';
import { classNames, minutesUntilExpiry, urgencyLevel, urgencyColor } from '@/utils/helpers';
import { Clock } from 'lucide-react';

interface Props {
  expiryTime: string;
  compact?: boolean;
}

export function CountdownTimer({ expiryTime, compact = false }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const mins = minutesUntilExpiry(expiryTime);
  const level = urgencyLevel(expiryTime);
  const color = urgencyColor(level);

  if (mins <= 0) {
    return (
      <span className={classNames('inline-flex items-center gap-1 text-sm font-semibold', color)}>
        <Clock className="h-4 w-4" /> Expired
      </span>
    );
  }

  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const display = hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;

  return (
    <span className={classNames('inline-flex items-center gap-1', compact ? 'text-sm' : 'text-base font-semibold', color)}>
      <Clock className={classNames('h-4 w-4', level === 'rescue' && 'animate-pulse')} />
      {display} left
    </span>
  );
}
