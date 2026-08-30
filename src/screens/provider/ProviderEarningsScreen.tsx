import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Booking } from '@/lib/types';

export const ProviderEarningsScreen = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: pro } = await supabase
        .from('professionals')
        .select('id')
        .order('rating', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pro) { setLoading(false); return; }
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('professional_id', (pro as { id: string }).id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      setBookings((data as Booking[]) || []);
      setLoading(false);
    })();
  }, []);

  const totalEarnings = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const thisWeek = bookings.filter((b) => {
    const d = new Date(b.scheduled_date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= 7;
  }).reduce((s, b) => s + Number(b.total_amount), 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Earnings" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Balance card */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <p className="text-sm text-white/80">Available Balance</p>
          <p className="mt-1 text-3xl font-extrabold">{inr(totalEarnings)}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1 bg-white/20 py-2.5 text-xs hover:bg-white/30">
              <Icons.ArrowDownToLine size={15} /> Withdraw
            </Button>
            <Button variant="secondary" className="flex-1 bg-white/20 py-2.5 text-xs hover:bg-white/30">
              <Icons.FileText size={15} /> Statement
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBox label="This Week" value={inr(thisWeek)} icon={<Icons.TrendingUp size={16} />} />
          <StatBox label="Completed" value={`${bookings.length}`} icon={<Icons.CheckCircle2 size={16} />} />
          <StatBox label="Avg. Rating" value="4.7" icon={<Icons.Star size={16} />} />
        </div>

        {/* Earnings chart (simple bars) */}
        <Card className="mt-4 p-4">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Weekly Earnings</h3>
          <div className="flex h-32 items-end justify-between gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const h = [40, 65, 30, 80, 55, 95, 70][i];
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-emerald-100" style={{ height: `${h}%` }}>
                    <div className="h-full w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400" style={{ height: `${h}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Transaction history */}
        <h3 className="mb-2 mt-4 text-sm font-bold text-gray-900">Transaction History</h3>
        {loading ? (
          <Spinner className="py-8" />
        ) : bookings.length === 0 ? (
          <Card className="p-4 text-center text-sm text-gray-500">No completed jobs yet.</Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b.id} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icons.ArrowUpRight size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{b.service_name}</p>
                  <p className="text-[11px] text-gray-400">{formatDate(b.scheduled_date)}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">+{inr(b.total_amount)}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <Card className="flex flex-col items-center p-3 text-center">
    <span className="text-emerald-500">{icon}</span>
    <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    <p className="text-[10px] text-gray-400">{label}</p>
  </Card>
);
