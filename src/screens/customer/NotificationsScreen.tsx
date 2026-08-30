import * as Icons from 'lucide-react';
import { TopBar } from '@/components/PhoneShell';
import { Card } from '@/components/ui';

type Notif = {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  body: string;
  time: string;
  tone: 'success' | 'info' | 'warning';
  unread?: boolean;
};

const NOTIFS: Notif[] = [
  { id: '1', icon: Icons.CheckCircle2, title: 'Booking Confirmed', body: 'Your AC Service & Cleaning is confirmed for Today, 11:00 AM. Imran Khan will be your technician.', time: '2 min ago', tone: 'success', unread: true },
  { id: '2', icon: Icons.Truck, title: 'Provider On The Way', body: 'Imran Khan has started and will arrive in approximately 15 minutes.', time: '10 min ago', tone: 'info', unread: true },
  { id: '3', icon: Icons.Percent, title: 'Special Offer Just For You', body: 'Flat 20% off on your first booking. Use code LUCKY20 at checkout. Hurry, limited time!', time: '1 hr ago', tone: 'info', unread: true },
  { id: '4', icon: Icons.Star, title: 'Rate Your Experience', body: 'Your Tap & Mixer Repair was completed. Share your feedback and help others.', time: '3 days ago', tone: 'warning' },
  { id: '5', icon: Icons.Gift, title: 'Refer & Earn ₹100', body: 'Invite friends to LuckySeva. Both you and your friend get ₹100 when they book their first service.', time: '5 days ago', tone: 'info' },
  { id: '6', icon: Icons.CheckCircle2, title: 'Service Completed', body: 'Your Tap & Mixer Repair has been marked complete. Thank you for choosing LuckySeva!', time: '1 week ago', tone: 'success' },
];

export const NotificationsScreen = () => {
  const unreadCount = NOTIFS.filter((n) => n.unread).length;

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
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
        {NOTIFS.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Icons.Bell size={28} />
            </div>
            <p className="text-sm font-semibold text-gray-800">No notifications</p>
            <p className="text-xs text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {NOTIFS.map((n) => {
              const Icon = n.icon;
              const toneColor = n.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : n.tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600';
              return (
                <Card key={n.id} className={`flex gap-3 p-3.5 ${n.unread ? 'border-emerald-100 bg-emerald-50/30' : ''}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneColor}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-gray-900">{n.title}</p>
                      {n.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{n.body}</p>
                    <p className="mt-1.5 text-[10px] font-medium text-gray-400">{n.time}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-center text-[10px] text-gray-400">You're all caught up</p>
      </div>
    </div>
  );
};
