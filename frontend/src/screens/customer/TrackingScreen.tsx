import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Avatar } from '@/components/ui';
import { LiveMap } from '@/components/LiveMap';
import { inr, formatRelativeDay } from '@/utils/format';
import { haversineKm } from '@/services/location';
import { fetchRoute, type RouteResult } from '@/services/routing';
import type { Booking, BookingStatus, Professional, ProviderTracking } from '@/types';

const STEPS: { key: BookingStatus; label: string; icon: string }[] = [
  { key: 'confirmed', label: 'Booking Confirmed', icon: 'CheckCircle' },
  { key: 'assigned', label: 'Provider Assigned', icon: 'UserCheck' },
  { key: 'on_the_way', label: 'Provider On The Way', icon: 'Truck' },
  { key: 'started', label: 'Service Started', icon: 'Wrench' },
  { key: 'completed', label: 'Service Completed', icon: 'PartyPopper' },
];

const STATUS_FLOW: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'started', 'completed'];

/**
 * Statuses worth polling for. `confirmed` is included so the customer sees a
 * provider accept the request (and then start the journey) without reloading.
 * Once the job is completed or cancelled there is nothing left to poll.
 */
const POLL_STATUSES: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'started'];

/**
 * The map is shown only while the journey is genuinely underway. Accepting a
 * booking (`assigned`) is not enough: nothing moves until the provider taps
 * Start Journey, and `started`/`completed`/`cancelled` mean the provider has
 * arrived, so live tracking stops there.
 */
const TRACKING_STATUSES: BookingStatus[] = ['on_the_way'];

/** A fix older than this is treated as gone — the GPS stopped sharing. */
const STALE_TRACKING_MS = 150000;

/** Background refresh while the booking is still in motion (mobile-friendly). */
const TRACKING_POLL_MS = 8000;

export const TrackingScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tracking, setTracking] = useState<ProviderTracking | null>(null);
  const [isLive, setIsLive] = useState(false);
  const loadedProfessionalId = useRef<string | null>(null);

  // Freshness is decided where the data arrives (an async callback), never
  // during render: a fix older than the staleness window means sharing stopped
  // (GPS off, permission revoked, app closed) and must not be drawn as live.
  const applyTracking = (tr: ProviderTracking) => {
    setTracking(tr);
    const age = tr.updated_at ? Date.now() - Date.parse(tr.updated_at) : Number.NaN;
    setIsLive(
      Boolean(
        tr.active &&
          tr.latitude != null &&
          tr.longitude != null &&
          !Number.isNaN(age) &&
          age < STALE_TRACKING_MS,
      ),
    );
  };

  // Fetch the provider profile once per assignment, not on every poll.
  const loadProfessional = (id: string | null | undefined) => {
    if (!id || id === loadedProfessionalId.current) return;
    loadedProfessionalId.current = id;
    api.catalog
      .professional(id)
      .then((res) => setProfessional(res.professional))
      .catch(() => setProfessional(null));
  };

  const load = () => {
    setLoading(true);
    setLoadError('');
    Promise.allSettled([api.customer.booking(bookingId), api.customer.bookingTracking(bookingId)])
      .then(([bookingResult, trackingResult]) => {
        // Booking details are the essential screen data. The live-location
        // endpoint is optional and must never make the whole screen go blank.
        if (bookingResult.status === 'rejected') throw bookingResult.reason;
        const b = bookingResult.value;
        setBooking(b);
        loadProfessional(b.professional_id);
        if (trackingResult.status === 'fulfilled') {
          applyTracking(trackingResult.value);
        } else {
          setTracking(null);
          setIsLive(false);
        }
      })
      .catch((error: unknown) => {
        setBooking(null);
        setTracking(null);
        setIsLive(false);
        loadedProfessionalId.current = null;
        setProfessional(null);
        setLoadError(error instanceof Error ? error.message : 'Please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  };

  // Silent refresh (no spinner) so a live in-progress job keeps the map fresh.
  useEffect(() => {
    if (!booking || !POLL_STATUSES.includes(booking.status)) return;
    const t = setInterval(() => {
      Promise.allSettled([api.customer.booking(bookingId), api.customer.bookingTracking(bookingId)])
        .then(([bookingResult, trackingResult]) => {
          if (bookingResult.status === 'fulfilled') {
            const b = bookingResult.value;
            setBooking(b);
            loadProfessional(b.professional_id);
          }
          if (trackingResult.status === 'fulfilled') {
            applyTracking(trackingResult.value);
          } else {
            // If location sharing can't be reached, don't leave a stale pin on
            // the map; booking progress and details remain visible regardless.
            setTracking(null);
            setIsLive(false);
          }
        })
        .catch(() => {});
    }, TRACKING_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, bookingId]);

  useEffect(load, [bookingId]);

  // Live position, taken only from the tracking feed. `professionals.latitude`
  // is the provider's saved base location, not where they are right now, so it
  // is never used to draw the pin.
  const livePro =
    isLive && tracking?.latitude != null && tracking.longitude != null
      ? { latitude: tracking.latitude, longitude: tracking.longitude }
      : null;
  const proLatKey = livePro ? Math.round(livePro.latitude * 500) : 0;
  const proLngKey = livePro ? Math.round(livePro.longitude * 500) : 0;

  // Road route for the Blinkit-style line. Refetched only when the provider
  // moves ~200 m or the fix changes — the routing service caches close calls.
  useEffect(() => {
    if (!booking || !isLive || !livePro) return;
    if (!TRACKING_STATUSES.includes(booking.status)) return;
    const { latitude: custLat, longitude: custLng } = booking;
    if (custLat == null || custLng == null) return;
    const proLat = livePro.latitude;
    const proLng = livePro.longitude;
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
  }, [booking?.status, booking?.latitude, booking?.longitude, proLatKey, proLngKey, isLive]);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Track Booking" /><Spinner className="py-20" /></div>;
  if (!booking) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <TopBar title="Track Booking" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Icons.ClipboardX size={28} />
          </div>
          <h2 className="mt-5 text-lg font-bold text-slate-900">Booking details unavailable</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
            {loadError || 'We couldn’t load this booking. Please check your connection and try again.'}
          </p>
          <Button onClick={load} className="mt-6 w-full max-w-xs">
            <Icons.RefreshCw size={16} /> Try again
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: 'bookings' })} className="mt-2 w-full max-w-xs text-slate-600">
            Back to My Bookings
          </Button>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  const hasCustomerCoords = booking.latitude != null && booking.longitude != null;
  // Only a fresh fix draws the provider pin; a stale or missing one leaves the
  // destination alone rather than lying about where the provider is.
  const proCoords = isLive ? livePro : null;
  // Full-bleed live map only while the journey is actually underway.
  const showLiveMap = hasCustomerCoords && TRACKING_STATUSES.includes(booking.status);
  const distanceKm = proCoords && hasCustomerCoords
    ? route
      ? route.distanceKm
      : haversineKm(booking.latitude!, booking.longitude!, proCoords.latitude, proCoords.longitude)
    : null;
  // Real road-route minutes when the route fetch succeeded; a ~20 km/h
  // straight-line estimate otherwise, floored so "1 min away" still says 2.
  const etaMin = route && distanceKm != null
    ? route.durationMin
    : distanceKm == null
      ? null
      : Math.max(2, Math.round((distanceKm / 20) * 60));

  // Requirement: never leave the customer guessing, and never hide the booking
  // because the GPS is unavailable.
  const locationNotice =
    booking.status === 'on_the_way'
      ? distanceKm != null
        ? null
        : tracking?.active
          ? 'Live location has not updated for a few minutes — your provider may be out of network range. You can call them below.'
          : "Live location will appear as soon as your provider's GPS reports in. They are on their way — call them below if you need an update."
      : booking.status === 'assigned'
        ? 'Live tracking starts when your provider taps Start Journey.'
        : null;

  const banner = (
    tone: 'live' | 'done' | 'bad',
    title: string,
    subtitle?: string,
  ) => (
    <div className={`rounded-2xl border p-4 text-white shadow-lg shadow-slate-950/10 ${tone === 'bad' ? 'border-red-400/30 bg-gradient-to-r from-red-600 to-rose-500' : tone === 'done' ? 'border-emerald-400/30 bg-gradient-to-r from-emerald-700 to-teal-600' : 'border-emerald-400/30 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950'}`}>
      <div className="flex items-center gap-3.5">
        {tone === 'done' ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icons.PartyPopper size={22} /></span>
        ) : tone === 'bad' ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icons.XCircle size={22} /></span>
        ) : (
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 ring-1 ring-emerald-300/20">
            <span className="absolute inset-2 animate-ping rounded-lg bg-emerald-400/20" />
            <Icons.Navigation size={21} className="relative text-emerald-300" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">{tone === 'live' ? 'Booking update' : tone === 'done' ? 'All wrapped up' : 'Booking update'}</p>
          <p className="mt-0.5 text-base font-bold tracking-tight">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-white/70">{subtitle}</p>}
        </div>
        {tone === 'live' && <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live</span>}
      </div>
    </div>
  );

  const bannerNode =
    isCancelled
      ? banner('bad', 'Booking Cancelled')
      : isCompleted
        ? banner('done', 'Service Completed!', booking.service_name)
        : booking.status === 'on_the_way'
          ? banner('live', 'Provider is on the way', etaMin ? `Estimated arrival in about ${etaMin} min` : booking.service_name)
          : banner('live', 'Service in Progress', booking.service_name);

  const noticeCard = locationNotice && (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
      <Icons.Info size={14} className="mt-0.5 shrink-0" />
      <span>{locationNotice}</span>
    </div>
  );

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
    // On phones, keep the familiar floating status and bottom sheet. On wider
    // screens, give the map and booking details their own side-by-side panels.
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <TopBar title="Track Booking" />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 flex flex-col md:absolute md:inset-0 md:flex-row md:gap-6 md:overflow-y-auto md:p-6 lg:gap-7 lg:p-8">
            <section className="relative min-h-0 flex-1 overflow-hidden bg-slate-200 md:min-h-[560px] md:rounded-[28px] md:border md:border-white md:shadow-xl md:shadow-slate-900/10">
              <LiveMap
                className="absolute inset-0 z-0 md:static md:h-full md:min-h-[560px]"
                customer={{ latitude: booking.latitude!, longitude: booking.longitude! }}
                professional={proCoords}
                route={route?.path ?? null}
              />

              {/* Map context and live distance */}
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 px-4 md:top-5 md:px-5">
                <div className="pointer-events-none mx-auto max-w-xl md:mx-0">{bannerNode}</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 py-2 pl-3 pr-4 text-xs font-semibold text-gray-800 shadow-lg shadow-slate-900/10 backdrop-blur-xl md:mt-3">
                  {proCoords ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      Live
                      <span className="text-gray-300">|</span>
                      {distanceKm == null ? (
                        <span className="text-gray-500">Measuring...</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Icons.Truck size={13} className="text-emerald-600" />
                          {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                      <span className="text-gray-500">Waiting for provider GPS</span>
                    </>
                  )}
                </div>
              </div>

            </section>

            {/* Bottom sheet on mobile; a clean details rail on laptop. */}
            <aside className="no-scrollbar absolute inset-x-0 bottom-0 z-10 max-h-[58%] overflow-y-auto rounded-t-3xl border-t border-white/80 bg-white/95 px-4 pb-4 pt-2.5 shadow-[0_-10px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl md:relative md:inset-auto md:flex md:max-h-full md:min-h-0 md:w-[360px] md:shrink-0 md:flex-col md:gap-3 md:overflow-y-auto md:rounded-[28px] md:border md:border-slate-200/80 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none lg:w-[390px]">
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-gray-200 md:hidden" />
            <div className="space-y-3 md:space-y-4">
              {noticeCard}
              {proCard}
              {timeline}
              {details}
              {isCompleted && finishCards}
            </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <TopBar title="Track Booking" />
      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-5 py-5 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 hidden md:block">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">LuckySeva · Booking #{booking.id.slice(0, 8)}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Your service journey</h2>
            <p className="mt-1 text-sm text-slate-500">Stay up to date with your professional and booking details.</p>
          </div>
          {bannerNode}
          <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start md:gap-5">
            {noticeCard}
            {proCard}
            {timeline}
            {details}
            {isCompleted && (
              <div className="space-y-2 pt-1">
                {finishCards}
              </div>
            )}
          </div>
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
