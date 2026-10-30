import { priorityInfo } from '@/utils/helpers';
import { classNames } from '@/utils/helpers';

interface Props {
  priority: string;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'sm' }: Props) {
  const info = priorityInfo(priority);
  const isRescue = priority === 'rescue';
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        info.color,
        isRescue && 'animate-pulse'
      )}
    >
      <span>{info.icon}</span>
      {info.label}
    </span>
  );
}
