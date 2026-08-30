import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useProviderBookings, useProfessionalWithFallback, usePayouts } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, EmptyState } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Booking } from '@/lib/types';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ProviderEarningsScreen = () => {
  const { providerId } = useApp();
  const { professional } = useProfessionalWithFallback(providerId);
  const { bookings, loading } = useProviderBookings(professional?.id || null, 'completed');
  const { payouts, reload: reloadPayouts } = usePayouts(professional?.id || null);
  const [showStatement, setShowStatement] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const completed = bookings.filter((b) => b.status === 'completed');
  const totalEarnings = completed.reduce((s, b) => s + Number(b.total_amount), 0);
  const withdrawn = payouts.filter((p) => p.status !== 'failed').reduce((s, p) => s + Number(p.amount), 0);
  const available = Math.max(totalEarnings - withdrawn, 0);
  const hasPendingWithdraw = payouts.some((p) => p.status === 'requested');

  const thisWeek = completed
    .filter((b) => {
      const diff = (new Date().getTime() - new Date(b.scheduled_date + 'T00:00:00').getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    })
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const avgRating = professional?.rating || 0;

  const weekMap = new Map<string, number>();
  DAY_KEYS.forEach((d) => weekMap.set(d, 0));
  completed.forEach((b) => {
    const day = new Date(b.scheduled_date + 'T00:00:00').getDay();
    const key = DAY_KEYS[day];
    weekMap.set(key, (weekMap.get(key) || 0) + Number(b.total_amount));
  });
  const maxDay = Math.max(100, ...Array.from(weekMap.values()));
  const chart = DAY_KEYS.map((d) => ({ day: d, amount: weekMap.get(d) || 0 }));

  const withdraw = async () => {
    if (!professional || available <= 0 || hasPendingWithdraw) return;
    setWithdrawing(true);
    await supabase.from('payouts').insert({ professional_id: professional.id, amount: available, status: 'requested' });
    setWithdrawing(false);
    reloadPayouts();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Earnings" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Balance card */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <p className="text-sm text-white/80">Available Balance</p>
          <p className="mt-1 text-3xl font-extrabold">{inr(available)}</p>
          {hasPendingWithdraw && <p className="mt-1 text-[11px] text-white/80">Withdrawal of {inr(withdrawn)} requested — processing</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={withdraw} disabled={withdrawing || available <= 0 || hasPendingWithdraw} className="flex-1 bg-white/20 py-2.5 text-xs hover:bg-white/30">
              {withdrawing ? 'Requesting...' : <><Icons.ArrowDownToLine size={15} /> {hasPendingWithdraw ? 'Withdrawal Pending' : 'Withdraw'}</>}
            </Button>
            <Button variant="secondary" onClick={() => setShowStatement(true)} className="flex-1 bg-white/20 py-2.5 text-xs hover:bg-white/30">
              <Icons.FileText size={15} /> Statement
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBox label="This Week" value={inr(thisWeek)} icon={<Icons.TrendingUp size={16} />} />
          <StatBox label="Completed" value={`${completed.length}`} icon={<Icons.CheckCircle2 size={16} />} />
          <StatBox label="Avg. Rating" value={avgRating ? `${avgRating}` : '—'} icon={<Icons.Star size={16} />} />
        </div>

        {/* Earnings chart (real, computed from completed jobs) */}
        <Card className="mt-4 p-4">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Weekly Earnings</h3>
          <div className="flex h-32 items-end justify-between gap-2">
            {chart.map(({ day, amount }) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center rounded-t-md bg-emerald-50">
                  <div
                    className="w-full max-w-6 rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400"
                    style={{ height: `${Math.max(amount > 0 ? 8 : 2, Math.round((amount / maxDay) * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{day}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Transaction history */}
        <h3 className="mb-2 mt-4 text-sm font-bold text-gray-900">Transaction History</h3>
        {loading ? (
          <Spinner className="py-8" />
        ) : completed.length === 0 ? (
          <Card className="p-4 text-center text-sm text-gray-500">No completed jobs yet.</Card>
        ) : (
          <div className="space-y-2">
            {completed.map((b) => (
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

      {showStatement && (
        <div className="absolute inset-0 z-40 flex flex-col bg-gray-50">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-3">
            <button onClick={() => setShowStatement(false)} className="text-gray-400"><Icons.X size={22} /></button>
            <p className="flex-1 text-base font-bold text-gray-900">Statement</p>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto space-y-2 p-4">
            {payouts.length > 0 && (
              <>
                <h3 className="text-sm font-bold text-gray-900">Withdrawals</h3>
                {payouts.map((p) => (
                  <Card key={p.id} className="flex items-center gap-3 p-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : p.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                      <Icons.ArrowDownToLine size={16} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold capitalize text-gray-900`}>{p.status}</p>
                      <p className="text-[11px] text-gray-400">{formatDate(p.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900">-{inr(p.amount)}</span>
                  </Card>
                ))}
                <div className="h-px bg-gray-200" />
              </>
            )}
            <h3 className="text-sm font-bold text-gray-900">Earnings</h3>
            {completed.length === 0 ? (
              <EmptyState icon={<Icons.Wallet size={26} />} title="No earnings yet" subtitle="Complete jobs to start earning." />
            ) : (
              completed.map((b: Booking) => (
                <Card key={b.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Icons.Wallet size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{b.service_name}</p>
                    <p className="text-[11px] text-gray-400">{formatDate(b.scheduled_date)} · {b.customer_name}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+{inr(b.total_amount)}</span>
                </Card>
              ))
            )}
            <div className="mt-1 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className="text-sm font-bold text-gray-900">Total earned</span>
              <span className="text-base font-bold text-emerald-600">{inr(totalEarnings)}</span>
            </div>
          </div>
        </div>
      )}
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