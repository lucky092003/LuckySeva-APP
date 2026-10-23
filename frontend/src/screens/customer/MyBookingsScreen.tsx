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

const TABS: { key: BookingFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
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
      // Do not swallow this. The booking can turn uncancellable between the
      // render and the tap (the professional accepts and sets off), and the
      // user has to be told why the cancel did not happen instead of the
      // dialog closing on them in silence.
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Bookings" showBack={false} right={
        <button onClick={() => navigate({ name: 'refunds' })} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <Icons.Undo2 size={14} /> Refunds
        </button>
      } />
      {/* Tabs */}
      <div className="flex shrink-0 justify-center gap-1 border-b border-gray-100 bg-white px-3 md:px-8">
        <div className="flex w-full max-w-3xl gap-1">
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
      </div>

      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-4 md:px-8 md:py-7">
        <div className="mx-auto w-full max-w-7xl">
        {loading ? (
          <Spinner className="py-16" />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<Icons.CalendarCheck size={28} />}
            title={`No ${tab} bookings`}
            subtitle="Your bookings will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
                  ? `\nA refund of ${inr(pendingCancel.total_amount)} has been paid and will be returned.`
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

const BookingCard = ({ booking, onTrack, onReview, onInvoice, onCancel, cancelling, onRefund, onReschedule, onSupport }: { booking: Booking; onTrack: () => void; onReview: () => void; onInvoice: () => void; onCancel: () => void; cancelling: boolean; onRefund: () => void; onReschedule: () => void; onSupport: () => void }) => {
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

  const REFUND_LABEL: Record<string, { label: string; tone: 'success' | 'warning' }> = {
    refund_pending: { label: 'Refund pending', tone: 'warning' },
    refunded: { label: 'Refunded', tone: 'success' },
    partially_refunded: { label: 'Partially refunded', tone: 'success' },
  };
  const refundInfo = booking.status === 'cancelled' || booking.status === 'completed'
    ? REFUND_LABEL[booking.payment_status]
    : undefined;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
          <p className="text-[11px] text-gray-500">{booking.professional_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={statusTone[booking.status]}>{statusLabel[booking.status]}</Badge>
          {refundInfo && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${refundInfo.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{refundInfo.label}</span>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><Icons.Calendar size={12} />{formatRelativeDay(booking.scheduled_date)}</span>
        <span className="flex items-center gap-1"><Icons.Clock size={12} />{booking.scheduled_time}</span>
        <span className="flex items-center gap-1"><Icons.Wallet size={12} />{inr(booking.total_amount)}</span>
      </div>
      <div className="mt-3 flex items-stretch gap-2 border-t border-gray-50 pt-3">
        {booking.status === 'completed' ? (
          <>
            <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onReview}>
              <Icons.Star size={14} /> <span className="truncate">Rate Service</span>
            </Button>
            <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={onInvoice}>
              <Icons.Receipt size={14} /> <span className="truncate">Invoice</span>
            </Button>
            <Button size="sm" variant="outline" className="min-w-0 flex-1 text-amber-600" onClick={onRefund}>
              <Icons.Undo2 size={14} /> <span className="truncate">Refund</span>
            </Button>
          </>
        ) : booking.status === 'cancelled' ? (
          ['paid', 'cash'].includes(booking.payment_status) ? (
            <Button size="sm" variant="outline" className="min-w-0 flex-1 text-amber-600" onClick={onRefund}>
              <Icons.Undo2 size={14} /> <span className="truncate">Request Refund</span>
            </Button>
          ) : null
        ) : (
          <>
            {/* min-w-0 on the labels is what actually lets the row shrink: a
                nowrap span defaults to min-width:auto, so without it the text
                pushed its button wider than the flex share and the rightmost
                button spilled out of the card. Icons stay fixed, the label
                takes the ellipsis on the narrowest phones. */}
            {/* Cancel/Reschedule only exist for the statuses the backend will
                accept — once the journey starts the row becomes Track +
                Support, which is what the customer actually needs then. */}
            {CANCELLABLE.includes(booking.status) ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-w-0 flex-1 gap-[6px] px-[8px] text-red-500"
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
                <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-[6px] px-[8px]" onClick={onReschedule}>
                  <Icons.CalendarClock size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">Reschedule</span>
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-[6px] px-[8px]" onClick={onTrack}>
              <Icons.Navigation size={14} className="shrink-0" />
              <span className="min-w-0 truncate">Track</span>
            </Button>
            {ONGOING.includes(booking.status) ? (
              <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-[6px] px-[8px]" onClick={onSupport}>
                <Icons.Headphones size={14} className="shrink-0" />
                <span className="min-w-0 truncate">Support</span>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
};
