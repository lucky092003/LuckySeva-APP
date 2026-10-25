import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProfessionalWithFallback, useUnreadNotifications } from '@/hooks';
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
  const { unread } = useUnreadNotifications(providerId);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('nearest');
  const [declining, setDeclining] = useState<Booking | null>(null);
  const [decliningBusy, setDecliningBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setActionError(null);
    try {
      await api.provider.accept(b.id);
    } catch (err) {
      // Taken, expired or the availability toggle is off - the backend has
      // the reason, and navigating on to a detail screen as if it worked is
      // how "I accepted and nothing happened" happens.
      setActionError(
        err instanceof Error ? err.message : 'Could not accept this request. Please try again.',
      );
      setTick((n) => n + 1);
      return;
    }
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
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <TopBar title="Requests" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Icons.UserPlus size={40} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">No provider account found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sign in or create a provider account to receive booking requests.</p>
          <Button onClick={() => navigate({ name: 'provider-auth' })}>Sign in as provider</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="lg:hidden">
        <TopBar
          title="Requests"
          showBack={false}
          right={
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate({ name: 'notifications' })}
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icons.Bell size={17} />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />}
              </button>
              <button onClick={() => setTick((n) => n + 1)} aria-label="Refresh requests" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                <Icons.RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          }
        />
      </div>
      <div className="hidden shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        <div className="flex w-full items-center justify-between gap-6 px-[25px] py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">Partner Workspace</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-950 dark:text-gray-50 lg:text-3xl">Requests & Active Jobs</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Respond faster to win more jobs near you.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${professional?.status === 'available' ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>
              <span className={`h-2 w-2 rounded-full ${professional?.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {professional?.status === 'available' ? 'Available for work' : 'Currently busy'}
            </span>
              <button onClick={() => setTick((n) => n + 1)} aria-label="Refresh request feed" className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:border-emerald-200 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <Icons.RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh feed
            </button>
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3 lg:w-full lg:px-[25px] lg:py-6">
        {/* Why the last accept didn't go through (taken / expired / offline). */}
        {actionError && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            <Icons.AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {/* Earnings snapshot — compact strip on phone, stat cards on desktop */}
        <div className="mb-3 lg:mb-6">
          {/* Phone / tablet: compact 3-up strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 rounded-2xl bg-white dark:bg-gray-900 p-2.5 shadow-sm ring-1 ring-gray-100 lg:hidden">
            {[
              { label: "Today's Earnings", value: inr(todayEarnings), icon: Icons.Wallet, text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
              { label: 'Jobs Done', value: `${todayCompleted.length}`, icon: Icons.CheckCircle2, text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/30' },
              { label: 'This Week', value: `${weekCompletedCount}`, icon: Icons.Calendar, text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="px-2 text-center">
                  <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                    <Icon size={14} className={s.text} />
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
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
              },
              {
                label: 'Jobs Done Today',
                value: `${todayCompleted.length}`,
                icon: Icons.CheckCircle2,
                highlight: false,
              },
              {
                label: 'This Week',
                value: `${weekCompletedCount}`,
                icon: Icons.Calendar,
                highlight: false,
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 group ${
                  s.highlight
                    ? 'bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/25'
                    : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100 hover:shadow-lg hover:shadow-gray-200/70 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800'
                }`}
              >
                <div className={`absolute -right-6 -top-8 h-28 w-28 rounded-full ${s.highlight ? 'bg-white/10' : 'bg-emerald-50 dark:bg-emerald-950/40'}`} />
                <div className="relative">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${s.highlight ? 'bg-white/15 backdrop-blur-sm' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                    <s.icon size={24} className={s.highlight ? '' : 'text-emerald-600 dark:text-emerald-400'} />
                  </div>
                  <p className={`mb-1 text-sm font-medium ${s.highlight ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{s.label}</p>
                  <p className="text-3xl font-extrabold tracking-tight xl:text-4xl">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-7">
        {/* Incoming work is the primary desktop task; active jobs live in a stable side rail. */}
        <section className="order-2 min-w-0 lg:order-1 lg:col-start-1 lg:row-start-1">
          <SectionHeading title="New requests" count={newRequests.length} tone="emerald" hint={feedScope} />
          <div className="mb-3 flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 lg:w-fit">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${sort === s.key ? 'bg-white text-emerald-700 shadow-sm dark:bg-gray-900' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3 pb-2 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : orderedRequests.length === 0 ? (
            <Card className="px-5 py-6 text-center shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"><Icons.Inbox size={22} /></div>
                <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">No new requests right now</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">New {field || 'service'} requests {feedScope} will appear here automatically.</p>
                <Button variant="outline" onClick={() => setTick((n) => n + 1)} className="mt-4 px-5 py-2 text-xs font-semibold"><Icons.RefreshCw size={13} /> Check again</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3 pb-2 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
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
        </section>

        <aside className="order-1 space-y-5 lg:order-2 lg:col-start-2 lg:row-start-1">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeading title="Active jobs" count={active.length} tone="sky" />
            {active.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center dark:border-gray-700 dark:bg-gray-950">
                <Icons.BriefcaseBusiness size={21} className="mx-auto text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-xs font-semibold text-gray-700 dark:text-gray-200">No active jobs</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Accept a request to see its progress here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {active.map((b) => <ActiveJobCard key={b.id} booking={b} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} />)}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Icons.MapPin size={18} /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Your service area</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{professional?.service_area || 'Your selected area'} · within {myRadius} km</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-[11px] dark:border-gray-800">
              <span className="text-slate-500 dark:text-slate-400">Trade</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{field || 'Home services'}</span>
            </div>
          </section>
        </aside>
      </div>
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
      <h3 className="text-sm font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
        }`}
      >
        {count}
      </span>
    </div>
    {hint && <span className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">{hint}</span>}
  </div>
);

/* Placeholder shown while the request feed is loading */
const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-100">
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-2.5 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="h-6 w-14 shrink-0 rounded-lg bg-emerald-100/70" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-2.5 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-2.5 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
    </div>
    <div className="mt-4 flex gap-2">
      <div className="h-9 flex-1 rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="h-9 flex-1 rounded-lg bg-emerald-100" />
    </div>
  </div>
);

const PILL = 'inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300';

const ACTIVE_STATUS: Record<string, { label: string; chip: string; icon: 'check' | 'nav' | 'tool' }> = {
  assigned: { label: 'Accepted', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400', icon: 'check' },
  on_the_way: { label: 'On the way', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', icon: 'nav' },
  started: { label: 'In service', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'tool' },
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
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        urgent ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
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
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{booking.service_name}</p>
        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {booking.customer_name} · {formatRelativeDay(booking.scheduled_date)}, {booking.scheduled_time}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-bold text-emerald-600">{inr(booking.total_amount)}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${meta.chip}`}>{meta.label}</span>
      </div>
      <Icons.ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5" />
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
  <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
    {/* Accent edge for jobs inside the provider's radius */}
    {km !== null && km <= myRadius && (
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600" />
    )}

    <button type="button" onClick={onView} className="block w-full p-4 pl-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset">
      {/* Headline: icon, service + NEW pulse, earnings */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/20">
          <Icons.Wrench size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{booking.service_name}</p>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" /> NEW
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{booking.customer_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ExpiryBanner deadline={booking.accept_deadline} />
          <span className="shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-sm font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
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
              <span className="ml-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">IN RADIUS</span>
            )}
          </span>
        )}
      </div>

      {/* Address */}
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        <Icons.MapPin size={12} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{booking.customer_address}</span>
      </p>

      {/* Job notes */}
      {booking.notes && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 p-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
          <Icons.StickyNote size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{booking.notes}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 dark:border-gray-800 pt-3">
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <Icons.Lock size={11} /> Phone unlocks after you accept
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-emerald-600 transition-transform group-hover:translate-x-0.5">
          View address <Icons.ChevronRight size={13} />
        </span>
      </div>
    </button>

    {/* Actions */}
    <div className="flex gap-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 p-3 pl-5">
      <Button variant="outline" onClick={onReject} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
        Decline
      </Button>
      <Button
        onClick={onAccept}
        className="flex-1 py-2.5 text-xs font-semibold"
      >
        Accept <Icons.ArrowRight size={14} />
      </Button>
    </div>
  </Card>
);
