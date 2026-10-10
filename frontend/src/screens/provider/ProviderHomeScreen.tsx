import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProfessionalWithFallback } from '@/hooks';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { inr, formatRelativeDay, slugToLabel } from '@/utils/format';
import { haversineKm } from '@/services/location';
import type { Booking } from '@/types';

const MINUTE_MS = 60000;

const isToday = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

const inLastSevenDays = (d: string) =>
  new Date(d + 'T00:00:00').getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;


const SORTS = [
  { key: 'nearest', label: 'Nearest first' },
  { key: 'newest', label: 'Newest first' },
] as const;

export const ProviderHomeScreen = () => {
  const { navigate, providerId } = useApp();
  const { professional, loading: proLoading } = useProfessionalWithFallback(providerId);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('nearest');
  const [declining, setDeclining] = useState<Booking | null>(null);
  const [decliningBusy, setDecliningBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!professional?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    api.provider
      .bookings()
      .then((data) => {
        if (cancelled) return;
        setRequests(data || []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setRequests([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [professional?.id, tick]);

  useEffect(() => {
    if (!professional?.id) {
      setMyBookings([]);
      return;
    }
    let cancelled = false;
    api.provider
      .myBookings()
      .then((data) => {
        if (!cancelled) setMyBookings(data || []);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [professional?.id, tick]);

  useEffect(() => {
    if (!professional?.id) return;
    // Refresh when the tab comes back to the foreground, plus a slow safety
    // net. A 15s timer refetched both feeds continuously, which burns the
    // Supabase quota and shows the provider a stale list anyway - the window
    // most providers check this screen in is idle.
    const refresh = () => setTick((n) => n + 1);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    const t = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      clearInterval(t);
    };
  }, [professional?.id]);

  const myId = professional?.id;
  const myRadius = professional?.service_radius_km || 60;
  const proHasCoords = professional?.latitude != null && professional?.longitude != null;

  const distanceTo = (b: Booking) =>
    b.latitude != null && b.longitude != null && proHasCoords
      ? haversineKm(professional!.latitude!, professional!.longitude!, b.latitude, b.longitude)
      : null;

  const newRequests = requests.filter((b) => {
    if (b.professional_id === myId) return true;
    if (declined.has(b.id)) return false;
    const km = distanceTo(b);
    if (km === null) return true;
    return km <= myRadius;
  });

  // The feed arrives newest-first from the API; distance sort is a re-order only.
  const orderedRequests =
    sort === 'newest'
      ? newRequests
      : [...newRequests].sort((a, b) => {
          const ka = distanceTo(a);
          const kb = distanceTo(b);
          if (ka === null) return kb === null ? 0 : 1;
          if (kb === null) return -1;
          return ka - kb;
        });

  // `assigned` belongs here too: an accepted job is neither a new request nor
  // history, so without this it vanishes from the Requests tab entirely.
  const active = myBookings.filter(
    (b) => b.status === 'assigned' || b.status === 'on_the_way' || b.status === 'started'
  );

  // Earnings snapshot for the strip above the feed
  const completed = myBookings.filter((b) => b.status === 'completed');
  const todayCompleted = completed.filter((b) => isToday(b.scheduled_date));
  const todayEarnings = todayCompleted.reduce((s, b) => s + Number(b.total_amount), 0);
  const weekCompletedCount = completed.filter((b) => isToday(b.scheduled_date) || inLastSevenDays(b.scheduled_date)).length;

  const accept = async (b: Booking) => {
    await api.provider.accept(b.id).catch(() => {});
    setTick((n) => n + 1);
    navigate({ name: 'provider-detail', bookingId: b.id });
  };

  const confirmDecline = async () => {
    if (!declining) return;
    const b = declining;
    setDecliningBusy(true);
    await api.provider.decline(b.id).catch(() => {});
    setDecliningBusy(false);
    setDeclining(null);
    // Hide it locally right away; the next poll re-syncs if the write failed.
    setDeclined((prev) => new Set(prev).add(b.id));
    setTick((n) => n + 1);
  };

  // The feed is routed by trade as well as distance, so say so on the header.
  const field = professional?.category_slug ? slugToLabel(professional.category_slug) : '';
  const feedScope = [
    field,
    `within ${myRadius} km${professional?.service_area ? ` of ${professional.service_area}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!proLoading && !professional) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        <TopBar title="Requests" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Icons.UserPlus size={40} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-800">No provider account found</p>
          <p className="text-xs text-gray-500">Sign in or create a provider account to receive booking requests.</p>
          <Button onClick={() => navigate({ name: 'provider-auth' })}>Sign in as provider</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Requests"
        showBack={false}
        right={
          <button
            onClick={() => setTick((n) => n + 1)}
            aria-label="Refresh requests"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <Icons.RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 pb-4 pt-3 lg:py-4">
        {/* Earnings snapshot — compact strip on phone, stat cards on desktop */}
        <div className="mb-3 lg:mb-6">
          {/* Phone / tablet: compact 3-up strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100 lg:hidden">
            {[
              { label: "Today's Earnings", value: inr(todayEarnings), icon: Icons.Wallet, text: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Jobs Done', value: `${todayCompleted.length}`, icon: Icons.CheckCircle2, text: 'text-sky-600', bg: 'bg-sky-50' },
              { label: 'This Week', value: `${weekCompletedCount}`, icon: Icons.Calendar, text: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="px-2 text-center">
                  <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                    <Icon size={14} className={s.text} />
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-gray-900">{s.value}</p>
                  <p className="mt-0.5 truncate text-[9px] font-medium text-gray-400">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Desktop: stat cards */}
          <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 xl:gap-6">
            {[
              {
                label: "Today's Earnings",
                value: inr(todayEarnings),
                icon: Icons.Wallet,
                highlight: true,
                iconBg: 'bg-white/15',
                iconText: '',
                labelClass: 'text-white/80',
              },
              {
                label: 'Jobs Done Today',
                value: `${todayCompleted.length}`,
                icon: Icons.CheckCircle2,
                highlight: false,
                iconBg: 'bg-emerald-100',
                iconText: 'text-emerald-600',
                labelClass: 'text-gray-500',
              },
              {
                label: 'This Week',
                value: `${weekCompletedCount}`,
                icon: Icons.Calendar,
                highlight: false,
                iconBg: 'bg-amber-100',
                iconText: 'text-amber-600',
                labelClass: 'text-gray-500',
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] group ${
                  s.highlight
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20 hover:shadow-2xl hover:shadow-emerald-500/30'
                    : 'bg-white text-gray-900 shadow-lg ring-1 ring-gray-200 hover:shadow-xl'
                }`}
              >
                <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full ${s.highlight ? 'bg-white/10' : 'bg-emerald-100'}`} />
                <div className={`absolute -bottom-6 -left-6 h-32 w-32 rounded-full ${s.highlight ? 'bg-white/5' : 'bg-teal-50'}`} />
                <div className="relative">
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 ${s.highlight ? s.iconBg : s.iconBg.replace('shadow-lg', 'shadow-sm')}`}>
                    <s.icon size={28} className={s.iconText} />
                  </div>
                  <p className={`mb-1 text-sm font-medium ${s.labelClass}`}>{s.label}</p>
                  <p className="text-3xl font-bold xl:text-4xl">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Active Jobs */}
        <SectionHeading title="Active Jobs" count={active.length} tone="sky" />
        {active.length === 0 ? (
          <p className="mb-4 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-3 text-center text-[11px] text-gray-400">
            Nothing in progress. Accept a request below to start a job.
          </p>
        ) : (
          <div className="mb-4 space-y-2">
            {active.map((b) => (
              <ActiveJobCard key={b.id} booking={b} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} />
            ))}
          </div>
        )}

        {/* Section: New Requests */}
        <SectionHeading title="New Requests" count={newRequests.length} tone="emerald" hint={feedScope} />
        <div className="mb-3 flex rounded-xl bg-gray-100 p-1 lg:w-fit">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                sort === s.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 pb-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : orderedRequests.length === 0 ? (
          <Card className="px-5 py-2 text-center shadow-sm">
            <div className="flex flex-col items-center py-2 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Icons.Inbox size={22} />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800">No new requests</p>
              <p className="mt-0.5 max-w-xs text-[11px] leading-snug text-gray-500">
                New {field || 'service'} requests {feedScope} will show up here automatically.
              </p>
            </div>
            <Button variant="outline" onClick={() => setTick((n) => n + 1)} className="mb-2 mt-1 px-5 py-1.5 text-xs font-semibold">
              <Icons.RefreshCw size={13} /> Check again
            </Button>
          </Card>
        ) : (
          <div className="space-y-3 pb-2">
            {orderedRequests.map((b) => (
              <RequestCard
                key={b.id}
                booking={b}
                km={distanceTo(b)}
                myRadius={myRadius}
                onView={() => navigate({ name: 'provider-detail', bookingId: b.id })}
                onAccept={() => accept(b)}
                onReject={() => setDeclining(b)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!declining}
        busy={decliningBusy}
        title="Decline this request?"
        message={
          declining
            ? `The ${declining.service_name} request from ${declining.customer_name} will be passed to other providers. You won't be able to accept it later.`
            : ''
        }
        confirmLabel="Decline"
        cancelLabel="Keep request"
        onConfirm={confirmDecline}
        onCancel={() => setDeclining(null)}
      />
    </div>
  );
};

const SectionHeading = ({
  title,
  count,
  hint,
  tone,
}: {
  title: string;
  count: number;
  hint?: string;
  tone: 'sky' | 'emerald';
}) => (
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <div className="flex shrink-0 items-center gap-2">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'
        }`}
      >
        {count}
      </span>
    </div>
    {hint && <span className="truncate text-[10px] font-medium text-gray-400">{hint}</span>}
  </div>
);

/* Placeholder shown while the request feed is loading */
const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-gray-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-gray-100" />
        <div className="h-2.5 w-1/4 rounded bg-gray-100" />
      </div>
      <div className="h-6 w-14 shrink-0 rounded-lg bg-emerald-100/70" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-2.5 w-3/4 rounded bg-gray-100" />
      <div className="h-2.5 w-2/3 rounded bg-gray-100" />
    </div>
    <div className="mt-4 flex gap-2">
      <div className="h-9 flex-1 rounded-lg bg-gray-100" />
      <div className="h-9 flex-1 rounded-lg bg-emerald-100" />
    </div>
  </div>
);

const PILL = 'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600';

const ACTIVE_STATUS: Record<string, { label: string; chip: string; icon: 'check' | 'nav' | 'tool' }> = {
  assigned: { label: 'Accepted', chip: 'bg-sky-50 text-sky-600', icon: 'check' },
  on_the_way: { label: 'On the way', chip: 'bg-amber-50 text-amber-600', icon: 'nav' },
  started: { label: 'In service', chip: 'bg-emerald-50 text-emerald-600', icon: 'tool' },
};

const ExpiryBanner = ({ deadline }: { deadline: string | null | undefined }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (isNaN(end)) return null;
  if (end <= now) return null;
  const mins = Math.ceil((end - now) / MINUTE_MS);
  const urgent = mins <= 3;
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        urgent ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${urgent ? 'bg-red-500' : 'bg-emerald-500'}`} />
      {mins}m left
    </span>
  );
};

const ActiveJobCard = ({ booking, onClick }: { booking: Booking; onClick: () => void }) => {
  const meta = ACTIVE_STATUS[booking.status] ?? ACTIVE_STATUS.assigned;
  return (
    <Card
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-3 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 ${meta.chip}`}>
        {meta.icon === 'nav' ? (
          <Icons.Navigation size={18} className="animate-pulse" />
        ) : meta.icon === 'tool' ? (
          <Icons.Wrench size={18} />
        ) : (
          <Icons.ClipboardCheck size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
        <p className="truncate text-[11px] text-gray-500">
          {booking.customer_name} · {formatRelativeDay(booking.scheduled_date)}, {booking.scheduled_time}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-bold text-emerald-600">{inr(booking.total_amount)}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}>{meta.label}</span>
      </div>
      <Icons.ChevronRight size={16} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
    </Card>
  );
};

const RequestCard = ({
  booking,
  km,
  myRadius,
  onView,
  onAccept,
  onReject,
}: {
  booking: Booking;
  km: number | null;
  myRadius: number;
  onView: () => void;
  onAccept: () => void;
  onReject: () => void;
}) => (
  <Card className="group relative overflow-hidden transition-shadow duration-200 hover:shadow-lg">
    {/* Accent edge for jobs inside the provider's radius */}
    {km !== null && km <= myRadius && (
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600" />
    )}

    <button type="button" onClick={onView} className="block w-full p-4 pl-5 text-left">
      {/* Headline: icon, service + NEW pulse, earnings */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Icons.Wrench size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
              <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" /> NEW
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{booking.customer_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ExpiryBanner deadline={booking.accept_deadline} />
          <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-sm font-extrabold tabular-nums text-emerald-700">
            {inr(booking.total_amount)}
          </span>
        </div>
      </div>

      {/* Meta pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={PILL}>
          <Icons.Calendar size={11} />
          {formatRelativeDay(booking.scheduled_date)}
        </span>
        <span className={PILL}>
          <Icons.Clock size={11} />
          {booking.scheduled_time}
        </span>
        {km !== null && (
          <span className={PILL}>
            <Icons.Navigation size={11} />
            {Math.round(km)} km
            {km <= myRadius && (
              <span className="ml-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">IN RADIUS</span>
            )}
          </span>
        )}
      </div>

      {/* Address */}
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
        <Icons.MapPin size={12} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{booking.customer_address}</span>
      </p>

      {/* Job notes */}
      {booking.notes && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
          <Icons.StickyNote size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{booking.notes}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
        <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
          <Icons.Lock size={11} /> Phone unlocks after you accept
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-emerald-600 transition-transform group-hover:translate-x-0.5">
          View address <Icons.ChevronRight size={13} />
        </span>
      </div>
    </button>

    {/* Actions */}
    <div className="flex gap-2 border-t border-gray-100 bg-gray-50/70 p-3 pl-5">
      <Button variant="outline" onClick={onReject} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50">
        Decline
      </Button>
      <Button
        onClick={onAccept}
        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
      >
        Accept <Icons.ArrowRight size={14} />
      </Button>
    </div>
  </Card>
);