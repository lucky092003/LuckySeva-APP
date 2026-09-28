import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useNotifications } from '@/hooks';
import { api } from '@/services/api';
import { CountBadge, Spinner } from '@/components/ui';
import { TYPE_ICON, TYPE_TONE } from '@/components/notificationTheme';
import { timeAgo } from '@/utils/format';
import type { Notification } from '@/types';

export const NotificationBell = () => {
  const { screen, navigate, customer } = useApp();
  const { notifications, unread, loading, marking, markAllRead, reload } = useNotifications(
    customer?.phone || null
  );
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [screen.name]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = async (n: Notification) => {
    setOpen(false);
    if (!n.read) {
      await api.customer.markNotificationRead(n.id).catch(() => {});
      reload();
    }
    if (n.booking_id) navigate({ name: 'tracking', bookingId: n.booking_id });
    else if (n.type === 'review') navigate({ name: 'bookings' });
  };

  const viewAll = () => {
    setOpen(false);
    navigate({ name: 'notifications' });
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          open ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-emerald-50/60 hover:text-emerald-700'
        }`}
      >
        <Icons.Bell size={18} />
        <CountBadge count={unread} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-emerald-900/10"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={marking}
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-60"
              >
                {marking ? <Icons.Loader2 size={12} className="animate-spin" /> : <Icons.CheckCheck size={13} />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <Spinner className="py-10" />
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Icons.Bell size={20} />
                </div>
                <p className="text-sm font-semibold text-gray-800">No notifications</p>
                <p className="mt-0.5 text-xs text-gray-500">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] || TYPE_ICON.bell;
                  const toneColor = TYPE_TONE[n.type] || TYPE_TONE.booking;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => openNotification(n)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          n.read ? '' : 'bg-emerald-50/40'
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneColor}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-bold text-gray-900">{n.title}</p>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-600">{n.message}</p>
                          <p className="mt-1 text-[10px] font-medium text-gray-400">{timeAgo(n.created_at)}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            onClick={viewAll}
            className="w-full border-t border-gray-100 py-2.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};
