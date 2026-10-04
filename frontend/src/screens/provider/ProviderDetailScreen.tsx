import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Badge } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { inr, formatRelativeDay } from '@/utils/format';
import type { Booking, BookingStatus } from '@/types';

const MINUTE_MS = 60000;

const NEXT_STATUS: Record<BookingStatus, BookingStatus | null> = {
  confirmed: 'assigned',
  assigned: 'on_the_way',
  on_the_way: 'started',
  started: 'completed',
  completed: null,
  cancelled: null,
};

const ExpiryTimer = ({ deadline }: { deadline: string | null | undefined }) => {
  if (!deadline) return null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(deadline).getTime();
  if (isNaN(end)) return null;
  if (end <= now) return <span className="text-[11px] font-semibold text-red-600">Expired</span>;
  const mins = Math.ceil((end - now) / MINUTE_MS);
  return <span className="text-[11px] font-semibold text-emerald-700">Expires in {mins}m</span>;
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
  const { back, navigate, providerId } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const load = () => {
    setLoading(true);
    api.provider
      .booking(bookingId)
      .then((data) => {
        setBooking(data);
        setLoading(false);
      })
      .catch(() => {
        setBooking(null);
        setLoading(false);
      });
  };
  useEffect(load, [bookingId]);

  const advance = async () => {
    if (!booking) return;
    const next = NEXT_STATUS[booking.status];
    if (!next) return;
    setUpdating(true);
    if (next === 'assigned') {
      await api.provider.accept(booking.id).catch(() => {});
    } else {
      await api.provider.updateStatus(booking.id, next as BookingStatus).catch(() => {});
    }
    setUpdating(false);
    load();
  };

  const confirmReject = async () => {
    if (!booking) return;
    setRejecting(true);
    await api.provider.decline(booking.id).catch(() => {});
    setRejecting(false);
    setShowReject(false);
    back();
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Booking Details" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Booking Details" /></div>;

  const nextStatus = NEXT_STATUS[booking.status];
  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';
  // The number is released on accept, never on merely reading the request.
  const showPhone = Boolean(booking.customer_phone) && (booking.status !== 'confirmed' || booking.professional_id === providerId);

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
          {booking.status === 'confirmed' && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Accept window</span>
              <ExpiryTimer deadline={booking.accept_deadline} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
              {booking.customer_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{booking.customer_name}</p>
              {showPhone ? (
                <p className="text-[11px] text-gray-500">{booking.customer_phone}</p>
              ) : (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <Icons.Lock size={11} /> Number unlocks after you accept
                </p>
              )}
            </div>
            {showPhone ? (
              <a href={`tel:${booking.customer_phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icons.Phone size={18} />
              </a>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                <Icons.Lock size={16} />
              </span>
            )}
          </div>
          {!showPhone && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
              <Icons.Lock size={13} className="mt-0.5 shrink-0" />
              <span>
                The customer's number is hidden while this request is open. Accept the job to see
                it and get the call button.
              </span>
            </p>
          )}
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
            <Button variant="outline" onClick={() => setShowReject(true)} disabled={updating} className="text-red-500">
              Reject
            </Button>
          )}
          <Button onClick={advance} disabled={updating} className="flex-1">
            {updating ? 'Updating...' : nextStatus === 'assigned' ? 'Accept Request' : nextStatus === 'on_the_way' ? 'Start Journey' : nextStatus === 'started' ? 'Start Service' : 'Mark Complete'}
          </Button>
        </div>
      )}
      {isCompleted && (
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white p-3">
          <Button onClick={() => navigate({ name: 'invoice', bookingId })} className="flex-1">
            <Icons.Receipt size={16} /> Generate Invoice
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showReject}
        busy={rejecting}
        title="Reject this request?"
        message={`The ${booking.service_name} request will be passed to other providers. You won't be able to accept it later.`}
        confirmLabel="Reject"
        cancelLabel="Keep request"
        onConfirm={confirmReject}
        onCancel={() => setShowReject(false)}
      />
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
