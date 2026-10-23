import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { Button, Spinner } from '@/components/ui';
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

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <div className="flex h-14 shrink-0 items-center justify-end px-5">
          <button
            onClick={() => navigate({ name: 'home' })}
            aria-label="Close booking confirmation"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <Icons.X size={19} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-12">
          <Spinner />
          <p className="text-sm font-medium text-slate-500">Confirming your booking…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7faf9]">
      <div className="flex h-14 shrink-0 items-center justify-between px-5 md:px-8">
        <div className="w-10" aria-hidden="true" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Booking status</p>
        <button
          onClick={() => navigate({ name: 'home' })}
          aria-label="Close booking confirmation"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Icons.X size={19} />
        </button>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-5 md:px-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-4 text-center sm:py-6">
          {/* A quieter success mark with a soft halo, rather than a large looping pulse. */}
          <div className="relative flex h-[88px] w-[88px] items-center justify-center">
            <div className="absolute inset-0 scale-[1.35] rounded-full bg-emerald-100/70 blur-xl" />
            <div className="absolute inset-0 rounded-full border border-emerald-200/70 bg-emerald-50/80" />
            <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-white">
              <Icons.Check size={36} strokeWidth={2.8} />
            </div>
          </div>
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 shadow-sm shadow-emerald-900/[0.03]">
            <Icons.Sparkles size={12} /> Request received
          </div>
          <h1 className="mt-3 text-[25px] font-extrabold tracking-tight text-slate-950">Booking confirmed!</h1>
          <p className="mt-2 max-w-sm text-[13px] leading-5 text-slate-500">
            Your service request is in. We’re matching you with the right professional and will keep you updated.
          </p>

          {booking && (
            <div className="mt-6 w-full overflow-hidden rounded-[22px] border border-slate-200/80 bg-white text-left shadow-[0_12px_35px_-24px_rgba(15,23,42,0.32)]">
              <div className="flex items-center gap-3.5 px-4 pb-4 pt-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 ring-1 ring-emerald-100">
                  <Icons.Wrench size={21} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-slate-900">{booking.service_name}</p>
                  <p className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">
                    BOOKING <span className="font-bold text-slate-500">#{booking.id.slice(0, 8).toUpperCase()}</span>
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Confirmed</span>
              </div>
              <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                <Row icon={<Icons.CalendarDays size={15} />} label="Date" value={formatRelativeDay(booking.scheduled_date)} />
                <Row icon={<Icons.Clock3 size={15} />} label="Time" value={booking.scheduled_time} />
                <Row icon={<Icons.UserRound size={15} />} label="Professional" value={booking.professional_name || 'Matching in progress'} />
              </div>
              <div className="mx-4 mb-4 flex items-center justify-between rounded-2xl bg-emerald-50/80 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800/60">Total amount</p>
                  <p className="mt-0.5 text-[11px] text-emerald-800/70">Payment for your service</p>
                </div>
                <span className="text-lg font-extrabold tracking-tight text-emerald-700">{inr(booking.total_amount)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/70 bg-white/90 px-5 pb-3 pt-3 backdrop-blur-xl md:px-8">
        <div className="mx-auto w-full max-w-md">
          <Button
            onClick={() => navigate({ name: 'tracking', bookingId })}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20 hover:from-emerald-600 hover:to-teal-700"
          >
            <Icons.Navigation size={16} /> Track booking <Icons.ArrowRight size={16} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate({ name: 'home' })}
            className="mt-1 w-full text-slate-500 hover:text-slate-800"
          >
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">{icon}</span>
    <span className="text-[11px] font-medium text-slate-400">{label}</span>
    <span className="ml-auto min-w-0 truncate pl-3 text-right text-xs font-semibold text-slate-800">{value}</span>
  </div>
);
