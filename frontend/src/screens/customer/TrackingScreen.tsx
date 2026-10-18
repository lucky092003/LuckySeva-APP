import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Avatar } from '@/components/ui';
import { LiveMap } from '@/components/LiveMap';
import { inr, formatRelativeDay } from '@/utils/format';
import { haversineKm } from '@/services/location';
import { fetchRoute, type RouteResult } from '@/services/routing';
import type { Booking, BookingStatus, Professional } from '@/types';

const STEPS: { key: BookingStatus; label: string; icon: string }[] = [
  { key: 'confirmed', label: 'Booking Confirmed', icon: 'CheckCircle' },
  { key: 'assigned', label: 'Provider Assigned', icon: 'UserCheck' },
  { key: 'on_the_way', label: 'Provider On The Way', icon: 'Truck' },
  { key: 'started', label: 'Service Started', icon: 'Wrench' },
  { key: 'completed', label: 'Service Completed', icon: 'PartyPopper' },
];

const STATUS_FLOW: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'started', 'completed'];

const LIVE_STATUSES: BookingStatus[] = ['assigned', 'on_the_way', 'started'];

export const TrackingScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.customer
      .booking(bookingId)
      .then((b) => {
        setBooking(b);
        if (b.professional_id) {
          api.catalog
            .professional(b.professional_id)
            .then((res) => setProfessional(res.professional))
            .catch(() => setProfessional(null));
        }
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  };

  // Silent refresh (no spinner) so a live in-progress job keeps the map fresh.
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = (status?: BookingStatus) => {
      if (status && LIVE_STATUSES.includes(status) && !t) {
        t = setInterval(() => {
          api.customer
            .booking(bookingId)
            .then((b) => {
              setBooking(b);
              if (b.professional_id) {
                api.catalog
                  .professional(b.professional_id)
                  .then((res) => setProfessional(res.professional))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }, 15000);
      }
    };
    start(booking?.status);
    return () => {
      if (t) clearInterval(t);
      t = null;
    };
  }, [booking?.status, bookingId]);

  useEffect(load, [bookingId]);

  // Road route for the Blinkit-style line. Refetched only when the provider
  // moves ~200 m or the fix changes — the routing service caches close calls.
  const proLatKey = Math.round((professional?.latitude ?? 0) * 500);
  const proLngKey = Math.round((professional?.longitude ?? 0) * 500);
  useEffect(() => {
    if (!booking || !professional) return;
    if (!LIVE_STATUSES.includes(booking.status)) return;
    const { latitude: custLat, longitude: custLng } = booking;
    if (custLat == null || custLng == null) return;
    if (professional.latitude == null || professional.longitude == null) return;
    const proLat = professional.latitude;
    const proLng = professional.longitude;
    let alive = true;
    const load = () =>
      fetchRoute(
        { latitude: proLat, longitude: proLng },
        { latitude: custLat, longitude: custLng },
      ).then((r) => {
        if (alive && r) setRoute(r);
      });
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, booking?.latitude, booking?.longitude, proLatKey, proLngKey]);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Track Booking" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Track Booking" /></div>;

  const currentIdx = STATUS_FLOW.indexOf(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  const hasCustomerCoords = booking.latitude != null && booking.longitude != null;
  const hasProCoords = professional?.latitude != null && professional?.longitude != null;
  // Full-bleed live map (Blinkit-style) while a pro is assigned and in motion.
  const showLiveMap =
    hasCustomerCoords && hasProCoords && LIVE_STATUSES.includes(booking.status);
  const distanceKm = route ? route.distanceKm : showLiveMap
    ? haversineKm(booking.latitude!, booking.longitude!, professional!.latitude!, professional!.longitude!)
    : null;
  // Real road-route minutes when the route fetch succeeded; a ~20 km/h
  // straight-line estimate otherwise, floored so "1 min away" still says 2.
  const etaMin = route
    ? route.durationMin
    : distanceKm == null
      ? null
      : Math.max(2, Math.round((distanceKm / 20) * 60));

  const banner = (
    tone: 'live' | 'done' | 'bad',
    title: string,
    subtitle?: string,
    compact = false,
  ) => (
    <div className={`rounded-2xl p-4 text-white ${tone === 'bad' ? 'bg-red-500' : tone === 'done' ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'} ${compact ? 'shadow-lg shadow-black/10' : ''}`}>
      <div className="flex items-center gap-3">
        {tone === 'done' ? (
          <Icons.PartyPopper size={28} />
        ) : tone === 'bad' ? (
          <Icons.XCircle size={28} />
        ) : (
          <Icons.Loader size={28} className="animate-spin" />
        )}
        <div>
          <p className="text-base font-bold">{title}</p>
          {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  const bannerNode =
    isCancelled
      ? banner('bad', 'Booking Cancelled')
      : isCompleted
        ? banner('done', 'Service Completed!', booking.service_name)
        : banner('live', 'Service in Progress', booking.service_name);

  const proCard = professional && (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar
          src={professional.avatar_url}
          name={professional.name}
          className="h-14 w-14 rounded-2xl text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{professional.name}</p>
          <p className="text-[11px] text-gray-500">{professional.skills.join(', ')}</p>
          <div className="mt-1 flex items-center gap-1">
            <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-semibold text-gray-700">{professional.rating}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {professional.phone ? (
            <a href={`tel:${professional.phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icons.Phone size={18} />
            </a>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600/40"><Icons.Phone size={18} /></span>
          )}
          <button onClick={() => navigate({ name: 'help' })} className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <Icons.MessageCircle size={18} />
          </button>
        </div>
      </div>
    </Card>
  );

  const timeline = !isCancelled && (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-bold text-gray-900">Booking Progress</h3>
      <div className="space-y-1">
        {STEPS.map((s, i) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[s.icon];
          const done = i <= currentIdx;
          const active = i === currentIdx && !isCompleted;
          return (
            <div key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'} ${active ? 'ring-4 ring-emerald-100' : ''}`}>
                  {done ? <Icons.Check size={16} /> : <Icon size={16} />}
                </div>
                {i < STEPS.length - 1 && <div className={`h-8 w-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-gray-100'}`} />}
              </div>
              <div className="pt-1.5">
                <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</p>
                {active && <p className="text-[11px] text-emerald-600">In progress...</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  const details = (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-bold text-gray-900">Booking Details</h3>
      <Detail icon={<Icons.Calendar size={15} />} label="Date" value={formatRelativeDay(booking.scheduled_date)} />
      <Detail icon={<Icons.Clock size={15} />} label="Time" value={booking.scheduled_time} />
      <Detail icon={<Icons.MapPin size={15} />} label="Address" value={booking.customer_address} />
      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
        <span className="text-sm font-bold text-gray-900">Total Paid</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : booking.payment_status === 'cash' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
            {booking.payment_status === 'cash' ? 'Cash on service' : booking.payment_status}
          </span>
          <span className="text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
        </div>
      </div>
    </Card>
  );

  const finishCards = (
    <>
      <Button onClick={() => navigate({ name: 'reviews', bookingId })} className="w-full">
        <Icons.Star size={16} /> Rate your experience
      </Button>
      <Button variant="outline" onClick={() => navigate({ name: 'invoice', bookingId })} className="mt-2 w-full">
        <Icons.Receipt size={16} /> View Invoice / Receipt
      </Button>
    </>
  );

  if (showLiveMap) {
    // Blinkit-style full-bleed map with floating status on top and details
    // docked in a bottom sheet.
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        <TopBar title="Track Booking" />
        <div className="relative flex-1 overflow-hidden">
          <LiveMap
            className="absolute inset-0 z-0"
            customer={{ latitude: booking.latitude!, longitude: booking.longitude! }}
            professional={{ latitude: professional!.latitude!, longitude: professional!.longitude! }}
            route={route?.path ?? null}
          />

          {/* Floating status + ETA on top of the map */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 px-4">
            <div className="pointer-events-none">{bannerNode}</div>
            <div className="mt-2 flex items-center gap-2 rounded-full bg-white/95 py-2 pl-3 pr-4 text-xs font-semibold text-gray-800 shadow-lg shadow-black/10 backdrop-blur">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Live
              <span className="text-gray-300">|</span>
              {distanceKm == null ? (
                <span className="text-gray-500">Locating provider...</span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icons.Truck size={13} className="text-emerald-600" />
                  {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}
                  <span className="font-normal text-gray-400">· reaching in ~{etaMin} min</span>
                </span>
              )}
            </div>
          </div>

          {/* Bottom sheet with everything else */}
          <div className="no-scrollbar absolute inset-x-0 bottom-0 z-10 max-h-[58%] overflow-y-auto rounded-t-3xl bg-white/95 px-4 pb-4 pt-2.5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
            <div className="space-y-3">
              {proCard}
              {timeline}
              {details}
              {isCompleted && finishCards}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Track Booking" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {bannerNode}
        <div className="mt-4 space-y-4">
          {proCard}
          {timeline}
          {details}
          {isCompleted && (
            <div className="space-y-0 pt-1">
              {finishCards}
            </div>
          )}
        </div>
      </div>
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
