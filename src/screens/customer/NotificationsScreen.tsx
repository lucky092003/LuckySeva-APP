import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useNotifications } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner } from '@/components/ui';
import type { Notification } from '@/lib/types';

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  booking: Icons.CheckCircle2,
  provider: Icons.Truck,
  payment: Icons.Wallet,
  review: Icons.Star,
  offer: Icons.Percent,
  alert: Icons.AlertCircle,
};

const TYPE_TONE: Record<string, string> = {
  booking: 'bg-emerald-50 text-emerald-600',
  provider: 'bg-sky-50 text-sky-600',
  payment: 'bg-violet-50 text-violet-600',
  review: 'bg-amber-50 text-amber-600',
  offer: 'bg-pink-50 text-pink-600',
  alert: 'bg-red-50 text-red-600',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
}

export const NotificationsScreen = () => {
  const { navigate, customer } = useApp();
  const { notifications, loading, reload } = useNotifications(customer?.phone || null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const open = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
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
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">{unreadCount} new</span>
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
              const Icon = TYPE_ICON[n.type] || Icons.Bell;
              const toneColor = TYPE_TONE[n.type] || 'bg-emerald-50 text-emerald-600';
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