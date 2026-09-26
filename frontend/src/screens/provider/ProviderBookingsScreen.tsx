import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProviderBookings, useProfessionalWithFallback } from '@/hooks';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Badge } from '@/components/ui';
import { inr, formatRelativeDay, formatDate } from '@/utils/format';
import type { Booking, BookingStatus } from '@/types';

const TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const ProviderBookingsScreen = () => {
  const { navigate, providerId } = useApp();
  const [tab, setTab] = useState('all');
  const { professional } = useProfessionalWithFallback(providerId);

  const status = tab === 'all' ? undefined : tab;
  const { bookings, loading } = useProviderBookings(professional?.id || null, status);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Bookings" showBack={false} />
      <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-white px-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 py-3 text-xs font-semibold ${tab === t.key ? 'text-emerald-600' : 'text-gray-400'}`}
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
          <EmptyState icon={<Icons.CalendarCheck size={28} />} title="No bookings" subtitle="Your bookings will appear here." />
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingRow key={b.id} booking={b} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BookingRow = ({ booking, onClick }: { booking: Booking; onClick: () => void }) => {
  const tone: Record<BookingStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
    confirmed: 'info', assigned: 'info', on_the_way: 'warning', started: 'warning', completed: 'success', cancelled: 'neutral',
  };
  const label: Record<BookingStatus, string> = {
    confirmed: 'New', assigned: 'Assigned', on_the_way: 'On the way', started: 'Active', completed: 'Done', cancelled: 'Cancelled',
  };
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
          <p className="text-[11px] text-gray-500">{booking.customer_name}</p>
        </div>
        <Badge tone={tone[booking.status]}>{label[booking.status]}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><Icons.Calendar size={11} />{formatRelativeDay(booking.scheduled_date)}</span>
        <span className="flex items-center gap-1"><Icons.Clock size={11} />{booking.scheduled_time}</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
        <span className="text-[11px] text-gray-400">{formatDate(booking.scheduled_date)}</span>
        <span className="text-sm font-bold text-emerald-600">{inr(booking.total_amount)}</span>
      </div>
    </Card>
  );
};
