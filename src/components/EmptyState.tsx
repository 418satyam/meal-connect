import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-gray-100 p-4 text-gray-400">
        {icon || <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-gray-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
