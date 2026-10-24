import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProviderBookings, useProfessionalWithFallback } from '@/hooks';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Badge } from '@/components/ui';
import { inr, formatRelativeDay, formatDate } from '@/utils/format';
import type { Booking, BookingStatus } from '@/types';

const TABS: { key: string; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

export const ProviderBookingsScreen = () => {
  const { navigate, providerId } = useApp();
  const [tab, setTab] = useState('upcoming');
  const { professional } = useProfessionalWithFallback(providerId);

  // `mine` accepts a single server-side status value; Upcoming collects every
  // not-yet-finished job (confirmed/assigned/on_the_way/started), so it filters
  // client-side on the full list instead.
  const status = tab === 'upcoming' || tab === 'all' ? undefined : tab;
  const { bookings, loading } = useProviderBookings(professional?.id || null, status);

  const shown =
    tab === 'upcoming'
      ? bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled')
      : bookings;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="lg:hidden"><TopBar title="My Bookings" showBack={false} /></div>
      <div className="hidden shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        <div className="flex w-full items-center justify-between gap-6 px-[25px] py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">Partner Workspace</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-950 dark:text-gray-50 lg:text-3xl">Your Bookings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep track of upcoming work and completed services.</p>
          </div>
          {professional && <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">{professional.name}</span>}
        </div>
      </div>
      <div className="shrink-0 border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-[25px]">
        <div className="flex w-full py-3">
          <div className="flex w-full gap-1 overflow-x-auto no-scrollbar lg:w-auto lg:rounded-xl lg:bg-gray-100 lg:p-1 dark:lg:bg-gray-800">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative min-w-[84px] flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors lg:flex-none ${tab === t.key ? 'bg-emerald-50 text-emerald-700 lg:bg-white lg:shadow-sm dark:bg-emerald-950/40 dark:text-emerald-400 dark:lg:bg-gray-900' : 'text-slate-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-4 lg:px-[25px] lg:py-7">
        <div className="w-full">
        {loading ? (
          <Spinner className="py-16" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Icons.CalendarCheck size={28} />}
            title={tab === 'upcoming' ? 'No upcoming bookings' : 'No bookings'}
            subtitle={tab === 'upcoming' ? 'Accepted jobs will appear here.' : 'Your bookings will appear here.'}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((b) => (
              <BookingRow key={b.id} booking={b} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} />
            ))}
          </div>
        )}
        </div>
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
    <Card onClick={onClick} className="group p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-lg lg:min-h-[170px] lg:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{booking.service_name}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{booking.customer_name}</p>
        </div>
        <Badge tone={tone[booking.status]}>{label[booking.status]}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><Icons.Calendar size={11} />{formatRelativeDay(booking.scheduled_date)}</span>
        <span className="flex items-center gap-1"><Icons.Clock size={11} />{booking.scheduled_time}</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(booking.scheduled_date)}</span>
        <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{inr(booking.total_amount)}</span>
      </div>
    </Card>
  );
};
