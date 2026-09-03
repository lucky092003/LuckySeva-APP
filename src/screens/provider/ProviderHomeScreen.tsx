import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useProviderBookings, useProfessionalWithFallback, insertBookingNotification } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Booking } from '@/lib/types';

const isToday = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

export const ProviderHomeScreen = () => {
  const { navigate, providerId } = useApp();
  const { professional } = useProfessionalWithFallback(providerId);
  const { bookings, loading, reload } = useProviderBookings(professional?.id || null);

  const newRequests = bookings.filter((b) => b.status === 'confirmed' || b.status === 'assigned');
  const active = bookings.filter((b) => b.status === 'on_the_way' || b.status === 'started');
  const completed = bookings.filter((b) => b.status === 'completed');
  const todayCompleted = completed.filter((b) => isToday(b.scheduled_date));
  const todayEarnings = todayCompleted.reduce((s, b) => s + Number(b.total_amount), 0);

  const accept = async (b: Booking) => {
    await supabase.from('bookings').update({ status: 'assigned' }).eq('id', b.id);
    await insertBookingNotification(b.customer_phone, 'provider', 'Provider Assigned', `${professional?.name || 'A professional'} has accepted your ${b.service_name} booking.`, b.id);
    reload();
    navigate({ name: 'provider-detail', bookingId: b.id });
  };

  const reject = async (b: Booking) => {
    if (!window.confirm(`Reject the ${b.service_name} request from ${b.customer_name}?`)) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
    await insertBookingNotification(b.customer_phone, 'alert', 'Request Declined', `Your ${b.service_name} booking could not be accepted. Please book again.`, b.id);
    reload();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Booking Requests" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {/* Earnings strip */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Icons.Wallet size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/80">Today's Earnings</p>
            <p className="text-xl font-bold">{inr(todayEarnings)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/80">Jobs Today</p>
            <p className="text-xl font-bold">{todayCompleted.length}</p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-bold text-gray-900">Active Jobs ({active.length})</h3>
        {active.length > 0 && (
          <div className="mb-4 space-y-2">
            {active.map((b) => (
              <Card key={b.id} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Icons.Loader size={18} className="animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                  <p className="text-[11px] text-gray-500">{b.customer_name} · {formatRelativeDay(b.scheduled_date)}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{inr(b.total_amount)}</span>
              </Card>
            ))}
          </div>
        )}

        <h3 className="mb-2 text-sm font-bold text-gray-900">New Requests ({newRequests.length})</h3>
        {loading ? (
          <Spinner className="py-10" />
        ) : newRequests.length === 0 ? (
          <EmptyState icon={<Icons.Inbox size={28} />} title="No new requests" subtitle="New booking requests will appear here." />
        ) : (
          <div className="space-y-3">
            {newRequests.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                    <p className="text-[11px] text-gray-500">{b.customer_name}</p>
                  </div>
                  <span className="text-base font-bold text-emerald-600">{inr(b.total_amount)}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><Icons.Calendar size={11} />{formatRelativeDay(b.scheduled_date)}</span>
                  <span className="flex items-center gap-1"><Icons.Clock size={11} />{b.scheduled_time}</span>
                  <span className="flex items-center gap-1"><Icons.MapPin size={11} />{b.customer_address.split(',').slice(-2)[0]?.trim()}</span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
                  <Button variant="outline" onClick={() => reject(b)} className="flex-1 py-2 text-xs text-red-500">Reject</Button>
                  <Button onClick={() => accept(b)} className="flex-1 py-2 text-xs">
                    Accept
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};