import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useBookings, BookingFilter } from '@/hooks';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Badge, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { inr, formatRelativeDay } from '@/utils/format';
import type { Booking, BookingStatus } from '@/types';

const TABS: {
  key: BookingFilter;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    key: 'upcoming',
    label: 'Upcoming',
    icon: Icons.Calendar as React.ComponentType<{ size?: number; className?: string }>,
  },
  {
    key: 'ongoing',
    label: 'Ongoing',
    icon: Icons.Clock as React.ComponentType<{ size?: number; className?: string }>,
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: Icons.CheckCircle2 as React.ComponentType<{ size?: number; className?: string }>,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: Icons.XCircle as React.ComponentType<{ size?: number; className?: string }>,
  },
];

/**
 * The backend refuses a cancel once the professional has set off:
 * `PUT /customer/bookings/{id}/cancel` answers 400 "Your professional has
 * already started. Please contact support." for `on_the_way` and `started`.
 * The card used to offer the Cancel button for those statuses anyway, so the
 * tap always failed — and the error was swallowed, so the dialog just closed
 * and the user was told nothing. Offer Cancel only where the backend accepts
 * it, and let the surviving race (status flips between render and tap) report
 * the real reason inside the dialog.
 */
const CANCELLABLE: BookingStatus[] = ['confirmed', 'assigned'];

/** The journey has started: the only useful actions are Track and Support. */
const ONGOING: BookingStatus[] = ['on_the_way', 'started'];

const STATUS_TONE: Record<BookingStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  confirmed: 'info',
  assigned: 'info',
  on_the_way: 'warning',
  started: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  on_the_way: 'On the way',
  started: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const REFUND_LABEL: Record<string, { label: string; tone: 'success' | 'warning' }> = {
  refund_pending: { label: 'Refund pending', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'success' },
  partially_refunded: { label: 'Partially refunded', tone: 'success' },
};

export const MyBookingsScreen = () => {
  const { navigate, customer } = useApp();
  const [tab, setTab] = useState<BookingFilter>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null);
  const [refundError, setRefundError] = useState('');
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const { bookings, loading, reload } = useBookings(tab, customer?.phone || undefined);

  const openReschedule = (b: Booking) => {
    setRescheduleBooking(b);
    setRescheduleDate(b.scheduled_date);
    setRescheduleTime(b.scheduled_time);
    setRescheduleError('');
  };

  const reschedule = async () => {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleTime.trim()) {
      setRescheduleError('Pick a new date and time');
      return;
    }
    setRescheduling(true);
    setRescheduleError('');
    try {
      await api.customer.rescheduleBooking(rescheduleBooking.id, {
        scheduled_date: rescheduleDate,
        scheduled_time: rescheduleTime.trim(),
      });
      setRescheduleBooking(null);
      reload();
    } catch (e) {
      setRescheduleError(e instanceof Error ? e.message : 'Could not reschedule booking');
    } finally {
      setRescheduling(false);
    }
  };

  const openCancel = (b: Booking) => {
    setPendingCancel(b);
    setCancelError('');
  };

  const cancel = async () => {
    if (!pendingCancel) return;
    const b = pendingCancel;
    setCancellingId(b.id);
    setCancelError('');
    try {
      await api.customer.cancelBooking(b.id);
      setPendingCancel(null);
      reload();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const requestRefund = async () => {
    if (!refundBooking || !refundReason.trim()) return;
    setRequestingRefund(true);
    setRefundError('');
    try {
      await api.customer.requestRefund(refundBooking.id, refundReason.trim());
      setRefundBooking(null);
      setRefundReason('');
      reload();
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : 'Could not submit refund request');
    } finally {
      setRequestingRefund(false);
    }
  };

  const TabButton = ({ t, count }: { t: typeof TABS[number]; count: number }) => {
    const active = tab === t.key;
    return (
      <button
        key={t.key}
        onClick={() => setTab(t.key)}
        aria-pressed={active}
        className={`flex min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'}`}
      >
        <t.icon size={12} className={`shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
        <span className="truncate">{t.label}</span>
        {active && count > 0 && (
          <span className="shrink-0 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f7f8f7]">
      <TopBar title="My Bookings" showBack={false} right={
        <button
          onClick={() => navigate({ name: 'refunds' })}
          aria-label="Refunds"
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Icons.Undo2 size={13} className="shrink-0" /> Refunds
        </button>
      } />
      <div className="shrink-0 border-b border-slate-200/70 bg-white px-5 py-3 lg:px-[25px]">
        <div className="mx-auto w-full">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TABS.map((t) => (
              <TabButton key={t.key} t={t} count={tab === t.key ? bookings.length : 0} />
            ))}
          </div>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 lg:px-[25px] lg:py-7">
        <div className="mx-auto w-full">
          {loading ? (
            <Spinner className="py-16" />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Icons.CalendarCheck size={32} className="text-slate-400" />}
              title={`No ${tab} bookings`}
              subtitle={
                tab === 'upcoming'
                  ? 'Your upcoming appointments will appear here once scheduled.'
                  : tab === 'completed'
                  ? 'Your finished bookings will appear here.'
                  : tab === 'cancelled'
                  ? 'Cancelled bookings will appear here.'
                  : 'Your active jobs will appear here once a professional accepts.'
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {bookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onTrack={() => navigate({ name: 'tracking', bookingId: b.id })}
                  onReview={() => navigate({ name: 'reviews', bookingId: b.id })}
                  onInvoice={() => navigate({ name: 'invoice', bookingId: b.id })}
                  onCancel={() => openCancel(b)}
                  cancelling={cancellingId === b.id}
                  onRefund={() => { setRefundBooking(b); setRefundReason(''); setRefundError(''); }}
                  onReschedule={() => openReschedule(b)}
                  onSupport={() => navigate({ name: 'help' })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingCancel}
        busy={!!pendingCancel && cancellingId === pendingCancel.id}
        title="Cancel this booking?"
        message={
          pendingCancel
            ? `Your ${pendingCancel.service_name} booking will be cancelled and the professional will be informed.${
                ['paid', 'cash', 'refund_pending'].includes(pendingCancel.payment_status)
                  ? ` A refund of ${inr(pendingCancel.total_amount)} will be returned.`
                  : ''
              }`
            : ''
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={cancel}
        onCancel={() => { setPendingCancel(null); setCancelError(''); }}
        extra={
          cancelError ? (
            <p className="mt-2 text-xs leading-relaxed text-red-500">{cancelError}</p>
          ) : undefined
        }
      />

      <ConfirmDialog
        open={!!refundBooking}
        busy={requestingRefund}
        title="Request Refund"
        message={
          refundBooking
            ? `Tell us what went wrong with your ${refundBooking.service_name} booking.\n\nRefund amount: ${inr(refundBooking.total_amount)}\n\nReason for refund:`
            : ''
        }
        confirmLabel="Submit Request"
        cancelLabel="Cancel"
        onConfirm={requestRefund}
        onCancel={() => setRefundBooking(null)}
        extra={
          <div className="mt-3">
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Describe the issue (e.g. service not completed, quality issues)..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {refundError && <p className="mt-1.5 text-xs text-red-500">{refundError}</p>}
          </div>
        }
      />
      <ConfirmDialog
        open={!!rescheduleBooking}
        busy={rescheduling}
        title="Reschedule Booking"
        message={rescheduleBooking ? `Pick a new date and time for your ${rescheduleBooking.service_name} booking.` : ''}
        confirmLabel="Reschedule"
        cancelLabel="Keep as is"
        onConfirm={reschedule}
        onCancel={() => setRescheduleBooking(null)}
        extra={
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-semibold text-gray-500">New date</label>
            <input
              type="date"
              value={rescheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <label className="block text-xs font-semibold text-gray-500">New time</label>
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {rescheduleError && <p className="text-xs text-red-500">{rescheduleError}</p>}
          </div>
        }
      />
    </div>
  );
};

const BookingCard = ({
  booking,
  onTrack,
  onReview,
  onInvoice,
  onCancel,
  cancelling,
  onRefund,
  onReschedule,
  onSupport,
}: {
  booking: Booking;
  onTrack: () => void;
  onReview: () => void;
  onInvoice: () => void;
  onCancel: () => void;
  cancelling: boolean;
  onRefund: () => void;
  onReschedule: () => void;
  onSupport: () => void;
}) => {
  const refundInfo =
    (booking.status === 'cancelled' || booking.status === 'completed') &&
    booking.payment_status in REFUND_LABEL
      ? REFUND_LABEL[booking.payment_status]
      : undefined;

  return (
    <Card className="relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{booking.service_name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{booking.professional_name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[booking.status]} className="text-[11px]">
            {STATUS_LABEL[booking.status]}
          </Badge>
          {refundInfo && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                refundInfo.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {refundInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Booking meta row */ }
      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 border-b border-slate-50 pb-2.5">
        <span className="flex items-center gap-1 shrink-0">
          <Icons.Calendar size={12} className="shrink-0" />
          {formatRelativeDay(booking.scheduled_date)}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <Icons.Clock size={12} className="shrink-0" />
          {booking.scheduled_time}
        </span>
        <span className="ml-auto flex items-center gap-1 font-bold text-emerald-700">
          <Icons.Wallet size={12} className="shrink-0" />
          {inr(booking.total_amount)}
        </span>
      </div>

      <div className="mt-3 flex items-stretch gap-2 border-t border-slate-50 pt-3">
        {/* Primary actions */ }
        {booking.status === 'completed' ? (
          <>
            <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onReview}>
              <Icons.Star size={14} className="shrink-0" />
              <span className="min-w-0 truncate">Rate Service</span>
            </Button>
            <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onInvoice}>
              <Icons.Receipt size={14} className="shrink-0" />
              <span className="min-w-0 truncate">Invoice</span>
            </Button>
            {refundInfo && (
              <Button
                size="sm"
                variant="outline"
                className="min-w-0 flex-1 text-amber-600"
                onClick={onRefund}
              >
                <Icons.Undo2 size={14} className="shrink-0" />
                <span className="min-w-0 truncate">{refundInfo.label === 'Refunded' ? 'Refunded' : 'Request Refund'}</span>
              </Button>
            )}
          </>
        ) : booking.status === 'cancelled' ? (
          ['paid', 'cash'].includes(booking.payment_status) ? (
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 flex-1 text-amber-600"
              onClick={onRefund}
            >
              <Icons.Undo2 size={14} className="shrink-0" />
              <span className="min-w-0 truncate">Request Refund</span>
            </Button>
          ) : null
        ) : (
          <>
            {CANCELLABLE.includes(booking.status) ? (
              <Button
                size="sm"
                variant="outline"
                className="min-w-0 flex-1 text-red-500"
                onClick={onCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <span className="min-w-0 truncate">Cancelling...</span>
                ) : (
                  <>
                    <Icons.X size={14} className="shrink-0" />
                    <span className="min-w-0 truncate">Cancel</span>
                  </>
                )}
              </Button>
            ) : null}
            {booking.status === 'confirmed' || booking.status === 'assigned' ? (
              <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onReschedule}>
                <Icons.CalendarClock size={14} className="shrink-0" />
                <span className="min-w-0 truncate">Reschedule</span>
              </Button>
            ) : null}
          </>
        )}

        {/* Track / Support actions */ }
        <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onTrack}>
          <Icons.Navigation size={14} className="shrink-0" />
          <span className="min-w-0 truncate">Track Booking</span>
        </Button>
        {ONGOING.includes(booking.status) ? (
          <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onSupport}>
            <Icons.Headphones size={14} className="shrink-0" />
            <span className="min-w-0 truncate">Chat Support</span>
          </Button>
        ) : null}
      </div>
    </Card>
  );
};
