import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useBookings, BookingFilter, insertBookingNotification } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Badge, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Booking } from '@/lib/types';

const TABS: { key: BookingFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const MyBookingsScreen = () => {
  const { navigate, customer } = useApp();
  const [tab, setTab] = useState<BookingFilter>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { bookings, loading, reload } = useBookings(tab, customer?.phone || undefined);

  const cancel = async (b: Booking) => {
    if (!window.confirm(`Cancel your ${b.service_name} booking?`)) return;
    setCancellingId(b.id);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
    await insertBookingNotification(b.customer_phone, 'alert', 'Booking Cancelled', `Your ${b.service_name} booking has been cancelled.`, b.id);
    setCancellingId(null);
    reload();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Bookings" showBack={false} />
      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-white px-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 py-3 text-xs font-semibold transition-colors ${tab === t.key ? 'text-emerald-600' : 'text-gray-400'}`}
          >
            {t.label}
            {tab === t.key && <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {loading ? (
          <Spinner className="py-16" />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<Icons.CalendarCheck size={28} />}
            title={`No ${tab} bookings`}
            subtitle="Your bookings will appear here."
          />
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onTrack={() => navigate({ name: 'tracking', bookingId: b.id })} onReview={() => navigate({ name: 'reviews', bookingId: b.id })} onCancel={() => cancel(b)} cancelling={cancellingId === b.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BookingCard = ({ booking, onTrack, onReview, onCancel, cancelling }: { booking: Booking; onTrack: () => void; onReview: () => void; onCancel: () => void; cancelling: boolean }) => {
  const statusTone: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    confirmed: 'info',
    assigned: 'info',
    on_the_way: 'warning',
    started: 'warning',
    completed: 'success',
    cancelled: 'neutral',
  };
  const statusLabel: Record<string, string> = {
    confirmed: 'Confirmed',
    assigned: 'Assigned',
    on_the_way: 'On the way',
    started: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
          <p className="text-[11px] text-gray-500">{booking.professional_name}</p>
        </div>
        <Badge tone={statusTone[booking.status]}>{statusLabel[booking.status]}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><Icons.Calendar size={12} />{formatRelativeDay(booking.scheduled_date)}</span>
        <span className="flex items-center gap-1"><Icons.Clock size={12} />{booking.scheduled_time}</span>
        <span className="flex items-center gap-1"><Icons.Wallet size={12} />{inr(booking.total_amount)}</span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
        {booking.status === 'completed' ? (
          <Button variant="outline" className="flex-1 py-2 text-xs" onClick={onReview}>
            <Icons.Star size={14} /> Rate Service
          </Button>
        ) : booking.status === 'cancelled' ? null : (
          <>
            <Button
              variant="outline"
              className="flex-1 py-2 text-xs text-red-500"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : <><Icons.X size={14} /> Cancel</>}
            </Button>
            <Button variant="outline" className="flex-1 py-2 text-xs" onClick={onTrack}>
              <Icons.Navigation size={14} /> Track Booking
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};
