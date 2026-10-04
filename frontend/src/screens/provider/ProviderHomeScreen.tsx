import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProfessionalWithFallback } from '@/hooks';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { inr, formatRelativeDay, slugToLabel } from '@/utils/format';
import { haversineKm } from '@/services/location';
import type { Booking } from '@/types';

const MINUTE_MS = 60000;

const SORTS = [
  { key: 'nearest', label: 'Nearest first' },
  { key: 'newest', label: 'Newest first' },
] as const;

const isToday = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

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
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
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
  const completed = myBookings.filter((b) => b.status === 'completed');
  const todayCompleted = completed.filter((b) => isToday(b.scheduled_date));
  const todayEarnings = todayCompleted.reduce((s, b) => s + Number(b.total_amount), 0);

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
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {/* Earnings strip */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm shadow-emerald-500/20">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icons.Wallet size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-white/80">Today's Earnings</p>
            <p className="text-xl font-bold">{inr(todayEarnings)}</p>
          </div>
          <div className="h-9 w-px shrink-0 bg-white/20" />
          <div className="shrink-0 pr-1 text-right">
            <p className="text-[11px] font-medium text-white/80">Jobs Done</p>
            <p className="text-xl font-bold">{todayCompleted.length}</p>
          </div>
        </div>

        <SectionHeading title="Active Jobs" count={active.length} />
        {active.length === 0 ? (
          <p className="mb-5 rounded-2xl border border-dashed border-gray-200 bg-white/60 px-4 py-5 text-center text-xs text-gray-400">
            Nothing in progress. Accept a request below to start a job.
          </p>
        ) : (
          <div className="mb-5 space-y-2">
            {active.map((b) => (
              <ActiveJobCard key={b.id} booking={b} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} />
            ))}
          </div>
        )}

        <SectionHeading title="New Requests" count={newRequests.length} hint={feedScope} />
        <div className="mb-3 flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                sort === s.key
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner className="py-10" />
        ) : orderedRequests.length === 0 ? (
          <EmptyState
            icon={<Icons.Inbox size={28} />}
            title="No new requests"
            subtitle={`New ${field || 'service'} requests ${feedScope} will show up here automatically.`}
          />
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

const SectionHeading = ({ title, count, hint }: { title: string; count: number; hint?: string }) => (
  <div className="mb-2 flex items-baseline justify-between gap-3">
    <h3 className="shrink-0 text-sm font-bold text-gray-900">
      {title} <span className="text-gray-400">({count})</span>
    </h3>
    {hint && <span className="truncate text-[10px] text-gray-400">{hint}</span>}
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
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      Expires in {mins}m
    </span>
  );
};

const ActiveJobCard = ({ booking, onClick }: { booking: Booking; onClick: () => void }) => {
  const meta = ACTIVE_STATUS[booking.status] ?? ACTIVE_STATUS.assigned;
  return (
    <Card onClick={onClick} className="flex items-center gap-3 p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.chip}`}>
        {meta.icon === 'nav' ? (
          <Icons.Navigation size={18} className="animate-pulse" />
        ) : meta.icon === 'tool' ? (
          <Icons.Wrench size={18} />
        ) : (
          <Icons.ClipboardCheck size={18} />
        )}
      </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-gray-900">{booking.service_name}</p>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">NEW</span>
            <ExpiryBanner deadline={booking.accept_deadline} />
          </div>
        <p className="truncate text-[11px] text-gray-500">
          {booking.customer_name} · {formatRelativeDay(booking.scheduled_date)}, {booking.scheduled_time}
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold text-emerald-600">{inr(booking.total_amount)}</span>
      <Icons.ChevronRight size={16} className="shrink-0 text-gray-300" />
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
  <Card className="overflow-hidden">
    <button type="button" onClick={onView} className="block w-full p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{booking.service_name}</p>
          <p className="text-[11px] text-gray-500">{booking.customer_name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">NEW</span>
        <span className="shrink-0 text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={PILL}><Icons.Calendar size={11} />{formatRelativeDay(booking.scheduled_date)}</span>
        <span className={PILL}><Icons.Clock size={11} />{booking.scheduled_time}</span>
        {km !== null && (
          <span className={PILL}>
            <Icons.Navigation size={11} />{Math.round(km)} km
            {km <= myRadius && (
              <span className="ml-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">IN RADIUS</span>
            )}
          </span>
        )}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
        <Icons.MapPin size={12} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{booking.customer_address}</span>
      </p>

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
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
          View address <Icons.ChevronRight size={13} />
        </span>
      </div>
    </button>

    <div className="flex gap-2 border-t border-gray-100 bg-gray-50/70 p-3">
      <Button variant="outline" onClick={onReject} className="flex-1 py-2.5 text-xs font-semibold text-red-500">Decline</Button>
      <Button onClick={onAccept} className="flex-1 py-2.5 text-xs">Accept <Icons.ArrowRight size={14} /></Button>
    </div>
  </Card>
);