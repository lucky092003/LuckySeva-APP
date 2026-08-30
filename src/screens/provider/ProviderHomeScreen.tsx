import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useProviderBookings } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Professional } from '@/lib/types';

// Provider app demo: load the first professional as the logged-in provider
const useCurrentProvider = () => {
  const [pro, setPro] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('professionals')
      .select('*')
      .order('rating', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPro((data as Professional) || null);
        setLoading(false);
      });
  }, []);
  return { professional: pro, loading };
};

export const ProviderHomeScreen = () => {
  const { navigate } = useApp();
  const { professional } = useCurrentProvider();
  const { bookings, loading } = useProviderBookings(professional?.id || null);

  const newRequests = bookings.filter((b) => b.status === 'confirmed' || b.status === 'assigned');
  const active = bookings.filter((b) => b.status === 'on_the_way' || b.status === 'started');

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Booking Requests" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {/* Earnings strip */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Icons.Wallet size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/80">Today's Earnings</p>
            <p className="text-xl font-bold">{inr(2148)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/80">Jobs</p>
            <p className="text-xl font-bold">4</p>
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

        <h3 className="mb-2 text-sm font-bold text-gray-900">New Requests ({newRequests.length})</h3>
        {loading ? (
          <Spinner className="py-10" />
        ) : newRequests.length === 0 ? (
          <EmptyState icon={<Icons.Inbox size={28} />} title="No new requests" subtitle="New booking requests will appear here." />
        ) : (
          <div className="space-y-3">
            {newRequests.map((b) => (
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
                  <span className="flex items-center gap-1"><Icons.MapPin size={11} />{b.customer_address.split(',').slice(-2)[0]?.trim()}</span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
                  <Button variant="outline" className="flex-1 py-2 text-xs text-red-500">Reject</Button>
                  <Button onClick={() => navigate({ name: 'provider-detail', bookingId: b.id })} className="flex-1 py-2 text-xs">
                    Accept
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
