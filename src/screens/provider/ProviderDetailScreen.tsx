import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { insertBookingNotification } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Badge } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Booking, BookingStatus } from '@/lib/types';

const NEXT_STATUS: Record<BookingStatus, BookingStatus | null> = {
  confirmed: 'assigned',
  assigned: 'on_the_way',
  on_the_way: 'started',
  started: 'completed',
  completed: null,
  cancelled: null,
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'New Request',
  assigned: 'Accepted',
  on_the_way: 'On the way',
  started: 'Service started',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ProviderDetailScreen = ({ bookingId }: { bookingId: string }) => {
  const { back } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
      .then(({ data }) => {
        setBooking((data as Booking) || null);
        setLoading(false);
      });
  };
  useEffect(load, [bookingId]);

  const advance = async () => {
    if (!booking) return;
    const next = NEXT_STATUS[booking.status];
    if (!next) return;
    setUpdating(true);
    await supabase.from('bookings').update({ status: next }).eq('id', booking.id);
    if (next === 'assigned') {
      await insertBookingNotification(booking.customer_phone, 'provider', 'Provider Assigned', `${booking.professional_name} has accepted your ${booking.service_name} booking.`, booking.id);
    }
    if (next === 'on_the_way') {
      await insertBookingNotification(booking.customer_phone, 'provider', 'Provider On The Way', `${booking.professional_name} is on the way to your location for ${booking.service_name}.`, booking.id);
    }
    if (next === 'completed') {
      await insertBookingNotification(booking.customer_phone, 'review', 'Service Completed', `${booking.service_name} is complete. Please pay ${inr(booking.total_amount)} and rate your experience.`, booking.id);
      if (booking.professional_id) {
        const { data: pro } = await supabase
          .from('professionals')
          .select('completed_jobs')
          .eq('id', booking.professional_id)
          .maybeSingle();
        const jobs = Number((pro as { completed_jobs?: number } | null)?.completed_jobs || 0);
        await supabase.from('professionals').update({ completed_jobs: jobs + 1 }).eq('id', booking.professional_id);
      }
    }
    setUpdating(false);
    load();
  };

  const reject = async () => {
    if (!booking) return;
    setUpdating(true);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    setUpdating(false);
    back();
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Booking Details" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Booking Details" /></div>;

  const nextStatus = NEXT_STATUS[booking.status];
  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Booking Details" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Status */}
        <div className={`mb-4 rounded-2xl p-4 text-white ${isCancelled ? 'bg-red-500' : isCompleted ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
          <p className="text-xs text-white/80">Current Status</p>
          <p className="text-lg font-bold">{STATUS_LABEL[booking.status]}</p>
        </div>

        {/* Customer info */}
        <Card className="mb-3 p-4">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Customer Details</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
              {booking.customer_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{booking.customer_name}</p>
              <p className="text-[11px] text-gray-500">{booking.customer_phone}</p>
            </div>
            <a href={`tel:${booking.customer_phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icons.Phone size={18} />
            </a>
          </div>
        </Card>

        {/* Service & address */}
        <Card className="mb-3 space-y-3 p-4">
          <Detail icon={<Icons.Wrench size={15} />} label="Service" value={booking.service_name} />
          <Detail icon={<Icons.Calendar size={15} />} label="Date" value={formatRelativeDay(booking.scheduled_date)} />
          <Detail icon={<Icons.Clock size={15} />} label="Time" value={booking.scheduled_time} />
          <Detail icon={<Icons.MapPin size={15} />} label="Address" value={booking.customer_address} />
          {booking.notes && <Detail icon={<Icons.StickyNote size={15} />} label="Notes" value={booking.notes} />}
        </Card>

        {/* Payment */}
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Payment</h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Method</span>
            <Badge tone="info">{booking.payment_method.toUpperCase()}</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <Badge tone={booking.payment_status === 'paid' ? 'success' : 'warning'}>
              {booking.payment_status === 'paid' ? 'Paid online' : booking.payment_status === 'cash' ? 'Cash on service' : 'Pending'}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
            <span className="text-sm font-bold text-gray-900">Total Earnings</span>
            <span className="text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
          </div>
        </Card>
      </div>

      {/* Actions */}
      {!isCancelled && !isCompleted && (
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white p-3">
          {booking.status === 'confirmed' && (
            <Button variant="outline" onClick={reject} disabled={updating} className="text-red-500">
              Reject
            </Button>
          )}
          <Button onClick={advance} disabled={updating} className="flex-1">
            {updating ? 'Updating...' : nextStatus === 'assigned' ? 'Accept Request' : nextStatus === 'on_the_way' ? 'Start Journey' : nextStatus === 'started' ? 'Start Service' : 'Mark Complete'}
          </Button>
        </div>
      )}
    </div>
  );
};

const Detail = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 text-gray-400">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value}</p>
    </div>
  </div>
);
