import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useProfessionalWithFallback, insertBookingNotification } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import { haversineKm } from '@/lib/location';
import type { Booking } from '@/lib/types';

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
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!professional?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('bookings')
      .select('*')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        const list = ((data as Booking[]) || []).filter(
          (b) => b.professional_id === professional.id || b.professional_id === null
        );
        setRequests(list);
        setLoading(false);
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
    supabase
      .from('bookings')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setMyBookings((data as Booking[]) || []);
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
    const km = distanceTo(b);
    if (km === null) return true;
    return km <= myRadius;
  });

  const active = myBookings.filter((b) => b.status === 'on_the_way' || b.status === 'started');
  const completed = myBookings.filter((b) => b.status === 'completed');
  const todayCompleted = completed.filter((b) => isToday(b.scheduled_date));
  const todayEarnings = todayCompleted.reduce((s, b) => s + Number(b.total_amount), 0);

  const accept = async (b: Booking) => {
    const next = {
      status: 'assigned',
      ...(b.professional_id ? {} : { professional_id: professional?.id || null, professional_name: professional?.name || b.professional_name }),
    };
    await supabase.from('bookings').update(next).eq('id', b.id);
    await insertBookingNotification(b.customer_phone, 'provider', 'Provider Assigned', `${professional?.name || 'A professional'} has accepted your ${b.service_name} booking.`, b.id);
    setTick((n) => n + 1);
    navigate({ name: 'provider-detail', bookingId: b.id });
  };

  const reject = async (b: Booking) => {
    if (!window.confirm(`Reject the ${b.service_name} request from ${b.customer_name}?`)) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
    await insertBookingNotification(b.customer_phone, 'alert', 'Request Declined', `Your ${b.service_name} booking could not be accepted. Please book again.`, b.id);
    setTick((n) => n + 1);
  };

  if (!proLoading && !professional) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        <TopBar title="Booking Requests" showBack={false} />
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
      <TopBar title="Booking Requests" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {/* Earnings strip */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Icons.Wallet size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/80">Today's Earnings</p>
            <p className="text-xl font-bold">{inr(todayEarnings)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/80">Jobs Today</p>
            <p className="text-xl font-bold">{todayCompleted.length}</p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-bold text-gray-900">Active Jobs ({active.length})</h3>
        {active.length > 0 && (
          <div className="mb-4 space-y-2">
            {active.map((b) => (
              <Card key={b.id} onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Icons.Loader size={18} className="animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                  <p className="text-[11px] text-gray-500">{b.customer_name} · {formatRelativeDay(b.scheduled_date)}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{inr(b.total_amount)}</span>
              </Card>
            ))}
          </div>
        )}

        <h3 className="text-sm font-bold text-gray-900">New Requests ({newRequests.length})</h3>
        <p className="mb-2 text-[10px] text-gray-400">
          Showing requests within {myRadius} km{professional?.service_area ? ` of ${professional.service_area}` : ''}
        </p>
        {loading ? (
          <Spinner className="py-10" />
        ) : newRequests.length === 0 ? (
          <EmptyState icon={<Icons.Inbox size={28} />} title="No new requests" subtitle="Customer requests within your radius will appear here." />
        ) : (
          <div className="space-y-3">
            {newRequests.map((b) => {
              const km = distanceTo(b);
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                      <p className="text-[11px] text-gray-500">{b.customer_name}</p>
                    </div>
                    <span className="text-base font-bold text-emerald-600">{inr(b.total_amount)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Icons.Calendar size={11} />{formatRelativeDay(b.scheduled_date)}</span>
                    <span className="flex items-center gap-1"><Icons.Clock size={11} />{b.scheduled_time}</span>
                    <span className="flex items-center gap-1 truncate"><Icons.MapPin size={11} />{b.customer_address.split(',').slice(-2)[0]?.trim()}</span>
                  </div>
                  {km !== null && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <Icons.Navigation size={11} />
                      {Math.round(km)} km away {km <= myRadius && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold">IN RADIUS</span>}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
                    <Button variant="outline" onClick={() => reject(b)} className="flex-1 py-2 text-xs text-red-500">Reject</Button>
                    <Button onClick={() => accept(b)} className="flex-1 py-2 text-xs">Accept</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};