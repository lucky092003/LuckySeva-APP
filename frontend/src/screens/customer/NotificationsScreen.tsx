import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useNotifications } from '@/hooks';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { TYPE_ICON, TYPE_TONE } from '@/components/notificationTheme';
import { Card, Spinner } from '@/components/ui';
import { timeAgo } from '@/utils/format';
import type { Notification } from '@/types';

export const NotificationsScreen = () => {
  const { navigate } = useApp();
  const { notifications, unread: unreadCount, loading, marking, markAllRead, reload } = useNotifications(null);

  const open = async (n: Notification) => {
    if (!n.read) {
      await api.customer.markNotificationRead(n.id).catch(() => {});
      reload();
    }
    if (n.booking_id) navigate({ name: 'tracking', bookingId: n.booking_id });
    else if (n.type === 'review') navigate({ name: 'bookings' });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-60"
            >
              {marking ? <Icons.Loader2 size={12} className="animate-spin" /> : <Icons.CheckCheck size={13} />}
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-3">
        {loading ? (
          <Spinner className="py-16" />
        ) : notifications.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Icons.Bell size={28} />
            </div>
            <p className="text-sm font-semibold text-gray-800">No notifications</p>
            <p className="text-xs text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] || TYPE_ICON.bell;
              const toneColor = TYPE_TONE[n.type] || TYPE_TONE.booking;
              return (
                <Card key={n.id} onClick={() => open(n)} className={`flex gap-3 p-3.5 ${!n.read ? 'border-emerald-100 bg-emerald-50/30' : ''}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneColor}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-gray-900">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{n.message}</p>
                    <p className="mt-1.5 text-[10px] font-medium text-gray-400">{timeAgo(n.created_at)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};