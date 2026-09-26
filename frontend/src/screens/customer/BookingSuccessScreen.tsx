import { useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { useState } from 'react';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/utils/format';
import type { Booking } from '@/types';

export const BookingSuccessScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.customer
      .booking(bookingId)
      .then((data) => {
        setBooking(data);
        setLoading(false);
      })
      .catch(() => {
        setBooking(null);
        setLoading(false);
      });
  }, [bookingId]);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="" showBack={false} /><Spinner className="py-20" /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <div className="flex shrink-0 items-center justify-end px-3 py-3">
        <button onClick={() => navigate({ name: 'home' })} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
          <Icons.X size={22} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Animated check */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200 opacity-60" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg">
            <Icons.Check size={48} className="text-white" strokeWidth={3} />
          </div>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">Booking Confirmed!</h1>
        <p className="mt-1.5 max-w-xs text-sm text-gray-500">
          Your booking has been placed successfully. We're assigning the best professional for your service.
        </p>

        {booking && (
          <Card className="mt-6 w-full max-w-xs space-y-3 p-4 text-left">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icons.Wrench size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{booking.service_name}</p>
                <p className="text-[11px] text-gray-500">Booking #{booking.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <Row icon={<Icons.Calendar size={14} />} label="Date" value={formatRelativeDay(booking.scheduled_date)} />
            <Row icon={<Icons.Clock size={14} />} label="Time" value={booking.scheduled_time} />
            <Row icon={<Icons.User size={14} />} label="Professional" value={booking.professional_name} />
            <div className="flex items-center justify-between border-t border-gray-50 pt-3">
              <span className="text-sm font-bold text-gray-900">Amount</span>
              <span className="text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
            </div>
          </Card>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-gray-100 bg-white p-3">
        <Button onClick={() => navigate({ name: 'tracking', bookingId })} className="w-full">
          <Icons.Navigation size={16} /> Track Booking
        </Button>
        <Button variant="ghost" onClick={() => navigate({ name: 'home' })} className="w-full text-gray-600">
          Back to Home
        </Button>
      </div>
    </div>
  );
};

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-gray-400">{icon}</span>
    <span className="text-[11px] text-gray-400">{label}</span>
    <span className="ml-auto text-xs font-semibold text-gray-900">{value}</span>
  </div>
);
