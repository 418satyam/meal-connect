import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/api';
import type { Notification } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { timeAgo, classNames } from '@/utils/helpers';

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setItems(await fetchNotifications()); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) return <LoadingSpinner label="Loading notifications..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const unread = items.filter((n) => !n.is_read).length;

  const typeColor: Record<string, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {unread > 0 && (
          <button onClick={handleAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No notifications" message="You'll be notified about donations, deliveries, and task updates here." icon={<Bell className="h-8 w-8" />} />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && handleRead(n.id)}
              className={classNames(
                'w-full text-left flex gap-3 rounded-xl border p-4 shadow-sm transition-colors',
                n.is_read ? 'border-gray-200 bg-white' : 'border-green-200 bg-green-50/40 hover:bg-green-50'
              )}
            >
              <span className={classNames('mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full', typeColor[n.type])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  {!n.is_read && <Circle className="h-2 w-2 flex-shrink-0 fill-green-500 text-green-500" />}
                </div>
                <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
