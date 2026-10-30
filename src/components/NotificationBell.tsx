import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/api';
import type { Notification } from '@/types';
import { timeAgo } from '@/utils/helpers';
import { classNames } from '@/utils/helpers';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications()
        .then(setItems)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const typeDot: Record<string, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="font-semibold text-gray-900">Notifications</span>
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs font-medium text-green-600 hover:text-green-700">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Loading...</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</p>
              ) : (
                items.map((n) => (
                  <Link
                    to="/notifications"
                    key={n.id}
                    onClick={() => handleMarkRead(n.id)}
                    className={classNames(
                      'flex gap-3 border-b border-gray-50 px-4 py-3 hover:bg-gray-50',
                      !n.is_read && 'bg-green-50/40'
                    )}
                  >
                    <span className={classNames('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', typeDot[n.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-gray-400">{timeAgo(n.created_at)}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
