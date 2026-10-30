import type { ReactNode } from 'react';
import { classNames } from '@/utils/helpers';

interface Props {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  color?: string;
  subtitle?: string;
}

export function DashboardCard({ title, value, icon, color = 'green', subtitle }: Props) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    teal: 'bg-teal-50 text-teal-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={classNames('rounded-lg p-3', colorMap[color])}>{icon}</div>
      </div>
    </div>
  );
}
