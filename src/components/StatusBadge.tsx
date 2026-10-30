import { classNames } from '@/utils/helpers';

interface Props {
  label: string;
  color: string;
}

export function StatusBadge({ label, color }: Props) {
  return (
    <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', color)}>
      {label}
    </span>
  );
}
