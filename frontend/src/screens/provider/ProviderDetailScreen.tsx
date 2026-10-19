import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import {
  describeShareFailure,
  requestLocationPermission,
  setLocationShareState,
  useLocationShareState,
} from '@/services/providerTracking';
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
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
  const share = useLocationShareState();

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

  /** Ask for GPS, publish the first fix, and remember what the customer can see. */
  const startSharing = async (id: string) => {
    const permission = await requestLocationPermission();
    if (permission.status === 'granted') {
      try {
        await api.provider.updateLocation(id, permission.coords);
        setLocationShareState('active');
      } catch (err) {
        setLocationShareState('unavailable', describeShareFailure(err));
      }
      return;
    }
    setLocationShareState(
      permission.status === 'denied' ? 'denied' : 'unavailable',
      permission.status === 'denied'
        ? 'Location permission is blocked, so the customer cannot see you on the map.'
        : 'No GPS fix yet — the customer will see your status but not your position.',
    );
  };

  const advance = async () => {
    if (!booking) return;
    const next = NEXT_STATUS[booking.status];
    if (!next) return;
    setUpdating(true);
    if (next === 'assigned') {
      await api.provider.accept(booking.id).catch(() => {});
    } else if (next === 'on_the_way') {
      // The journey is what turns tracking on, so ask for location right here:
      // the prompt makes sense in context, and the first fix reaches the
      // customer's map immediately instead of waiting for the next poll.
      await api.provider.updateStatus(booking.id, next).catch(() => {});
      await startSharing(booking.id);
    } else {
      await api.provider.updateStatus(booking.id, next as BookingStatus).catch(() => {});
    }
    setUpdating(false);
    load();
  };

  const retrySharing = async () => {
    if (!booking) return;
    setUpdating(true);
    await startSharing(booking.id);
    setUpdating(false);
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
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <TopBar title="Booking Details" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Status */}
        <div className={`mb-4 rounded-2xl p-4 text-white ${isCancelled ? 'bg-red-500' : isCompleted ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
          <p className="text-xs text-white/80">Current Status</p>
          <p className="text-lg font-bold">{STATUS_LABEL[booking.status]}</p>
        </div>

        {/* Customer info */}
        <Card className="mb-3 p-4">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Customer Details</h3>
          {booking.status === 'confirmed' && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Accept window</span>
              <ExpiryTimer deadline={booking.accept_deadline} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-bold text-gray-600 dark:text-gray-300">
              {booking.customer_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{booking.customer_name}</p>
              {showPhone ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{booking.customer_phone}</p>
              ) : (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <Icons.Lock size={11} /> Number unlocks after you accept
                </p>
              )}
            </div>
            {showPhone ? (
              <a href={`tel:${booking.customer_phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                <Icons.Phone size={18} />
              </a>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600">
                <Icons.Lock size={16} />
              </span>
            )}
          </div>
          {!showPhone && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
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
          {/* Real turn-by-turn directions live in the Google Maps app — Google's
              terms don't allow embedded navigation inside a WebView. */}
          {booking.latitude != null && booking.longitude != null && (
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`,
                  '_blank',
                  'noopener',
                )
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              <Icons.Navigation size={16} /> Navigate to Customer
            </button>
          )}
        </Card>

        {/* Location sharing status */}
        {booking.status === 'on_the_way' && (
          <Card className="mb-3 p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Location Sharing</h3>
            {share.state === 'active' && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Icons.MapPin size={14} className="mt-0.5" />
                <span>
                  Live location is streaming to the customer. If the map doesn't show you, switch to high-accuracy GPS and disable battery-saving mode for this app.
                </span>
              </div>
            )}
            {share.state === 'denied' && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Icons.AlertCircle size={14} className="mt-0.5" />
                  <span>
                    {share.detail || 'Location permission is blocked, so the customer cannot see your position. Allow access in device settings and retry.'}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={retrySharing} disabled={updating} className="w-full">
                  <Icons.RefreshCw size={14} /> Retry Sharing
                </Button>
              </div>
            )}
            {(share.state === 'unavailable' || share.state === 'idle') && share.detail && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Icons.AlertTriangle size={14} className="mt-0.5" />
                  <span>{share.detail}</span>
                </div>
                <Button variant="outline" size="sm" onClick={retrySharing} disabled={updating} className="w-full">
                  <Icons.RefreshCw size={14} /> Retry Sharing
                </Button>
              </div>
            )}
            {share.state === 'idle' && !share.detail && (
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <Icons.MapPin size={14} className="mt-0.5" />
                <span>Waiting for a GPS fix to share with the customer.</span>
              </div>
            )}
          </Card>
        )}

        {/* Payment */}
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">Payment</h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Method</span>
            <Badge tone="info">{booking.payment_method.toUpperCase()}</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
            <Badge tone={booking.payment_status === 'paid' ? 'success' : 'warning'}>
              {booking.payment_status === 'paid' ? 'Paid online' : booking.payment_status === 'cash' ? 'Cash on service' : 'Pending'}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total Earnings</span>
            <span className="text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
          </div>
        </Card>
      </div>

      {/* Actions */}
      {!isCancelled && !isCompleted && (
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
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
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
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
    <span className="mt-0.5 text-gray-400 dark:text-gray-500">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  </div>
);
