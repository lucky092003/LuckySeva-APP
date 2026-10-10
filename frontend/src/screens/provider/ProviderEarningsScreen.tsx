import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProviderBookings, useProfessionalWithFallback, usePayouts } from '@/hooks';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, EmptyState } from '@/components/ui';
import { inr, formatDate } from '@/utils/format';
import type { Booking } from '@/types';

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Period = 'week' | 'month' | 'year';

export const ProviderEarningsScreen = () => {
  const { providerId } = useApp();
  const { professional } = useProfessionalWithFallback(providerId);
  const { bookings, loading } = useProviderBookings(professional?.id || null, 'completed');
  const { payouts, reload: reloadPayouts } = usePayouts(professional?.id || null);
  const [showStatement, setShowStatement] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');

  const completed = bookings.filter((b) => b.status === 'completed');
  const totalEarnings = completed.reduce((s, b) => s + Number(b.total_amount), 0);
  const withdrawn = payouts.filter((p) => p.status !== 'failed').reduce((s, p) => s + Number(p.amount), 0);
  const available = Math.max(totalEarnings - withdrawn, 0);
  const hasPendingWithdraw = payouts.some((p) => p.status === 'requested');

  const startOfWeek = (d: Date) => {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return monday;
  };
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const thisWeek = completed
    .filter((b) => {
      const d = new Date(b.scheduled_date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    })
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const avgRating = professional?.rating || 0;

  const now = new Date();
  const thisMonth = completed
    .filter((b) => {
      const d = new Date(b.scheduled_date + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const thisYear = completed
    .filter((b) => {
      const d = new Date(b.scheduled_date + 'T00:00:00');
      return d.getFullYear() === now.getFullYear();
    })
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const weekMap = new Map<string, number>();
  DAY_KEYS.forEach((d) => weekMap.set(d, 0));
  completed.forEach((b) => {
    const d = new Date(b.scheduled_date + 'T00:00:00');
    const isThisWeek = d >= weekStart && d < weekEnd;
    if (isThisWeek) {
      const day = d.getDay();
      const key = DAY_KEYS[(day + 6) % 7];
      weekMap.set(key, (weekMap.get(key) || 0) + Number(b.total_amount));
    }
  });
  const chartData = DAY_KEYS.map((d) => ({ label: d, amount: weekMap.get(d) || 0 }));

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayMap = new Map<number, number>();
  for (let i = 1; i <= daysInMonth; i++) dayMap.set(i, 0);
  completed.forEach((b) => {
    const d = new Date(b.scheduled_date + 'T00:00:00');
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      dayMap.set(d.getDate(), (dayMap.get(d.getDate()) || 0) + Number(b.total_amount));
    }
  });
  const monthData = Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => ({
    label: String(d),
    amount: dayMap.get(d) || 0,
  }));

  const yearMap = new Map<string, number>();
  MONTH_KEYS.forEach((m) => yearMap.set(m, 0));
  completed.forEach((b) => {
    const d = new Date(b.scheduled_date + 'T00:00:00');
    if (d.getFullYear() === now.getFullYear()) {
      const key = MONTH_KEYS[d.getMonth()];
      yearMap.set(key, (yearMap.get(key) || 0) + Number(b.total_amount));
    }
  });
  const yearData = MONTH_KEYS.map((m) => ({ label: m, amount: yearMap.get(m) || 0 }));

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevYear = new Date(now.getFullYear() - 1, 0, 1);
  const thisYearEnd = new Date(now.getFullYear(), 0, 1);

  const inRange = (b: Booking, from: Date, to: Date) => {
    const d = new Date(b.scheduled_date + 'T00:00:00');
    return d >= from && d < to;
  };
  const sumRange = (from: Date, to: Date) =>
    completed.filter((b) => inRange(b, from, to)).reduce((s, b) => s + Number(b.total_amount), 0);

  const periodTotal = period === 'week' ? thisWeek : period === 'month' ? thisMonth : thisYear;
  const prevPeriodTotal =
    period === 'week'
      ? sumRange(prevWeekStart, weekStart)
      : period === 'month'
      ? sumRange(prevMonthDate, prevMonthEnd)
      : sumRange(prevYear, thisYearEnd);
  const trendPct = prevPeriodTotal > 0 ? Math.round(((periodTotal - prevPeriodTotal) / prevPeriodTotal) * 100) : null;
  const isPositiveTrend = trendPct === null ? true : trendPct >= 0;

  /* Round the axis max UP to a clean number so the bars keep a correct scale */
  const niceMax = (m: number) => {
    if (m <= 100) return 100;
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
      if (f * pow >= m) return f * pow;
    }
    return 10 * pow;
  };

  /* Week → per-day bars | Month → per-date bars (full month) | Year → per-month bars */
  const chartBars = period === 'week' ? chartData : period === 'month' ? monthData : yearData;
  const periodMax = niceMax(
    Math.max(100, ...chartBars.map((d) => d.amount))
  );

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year';

  const maxBarAmount = Math.max(...chartBars.map((d) => d.amount));
  const bestBar = chartBars.reduce((a, b) => (b.amount > a.amount ? b : a), chartBars[0]);
  const avgPerBar = Math.round(chartBars.reduce((s, d) => s + d.amount, 0) / chartBars.length);

  const todayDate = now.getDate();
  const todayMonth = now.getMonth();

  const withdraw = async () => {
    if (!professional || available <= 0 || hasPendingWithdraw) return;
    setWithdrawing(true);
    await api.provider.requestPayout(available).catch(() => {});
    setWithdrawing(false);
    reloadPayouts();
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    { label: 'Available Balance', value: inr(available), icon: Icons.Wallet, grad: 'from-emerald-500 to-teal-600', highlight: true },
    { label: 'This Week', value: inr(thisWeek), icon: Icons.TrendingUp, grad: 'from-sky-500 to-blue-600', highlight: false },
    { label: 'Total Earned', value: inr(totalEarnings), icon: Icons.IndianRupee, grad: 'from-violet-500 to-purple-600', highlight: false },
    { label: 'Jobs Done', value: `${completed.length}`, icon: Icons.CheckCircle2, grad: 'from-amber-500 to-orange-600', highlight: false },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Earnings"
        showBack={false}
        right={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-gray-400 lg:block">{today}</span>
            <Button variant="outline" onClick={() => setShowStatement(true)} className="gap-1.5 px-2 py-1 text-xs">
              <Icons.FileText size={13} />
            </Button>
            <Button onClick={withdraw} disabled={withdrawing || available <= 0 || hasPendingWithdraw} className="gap-1.5 bg-emerald-500 px-2 py-1 text-xs hover:bg-emerald-600 disabled:opacity-50">
              <Icons.ArrowDownToLine size={13} /> {withdrawing ? '...' : hasPendingWithdraw ? 'Pending' : 'Withdraw'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar lg:p-6">
        {/* Mobile: Balance card | Desktop: Stats grid */}
        <div className="lg:mb-6">
          {/* Mobile Balance Card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg lg:hidden">
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

          {/* Desktop Stats Grid */}
          <div className="hidden lg:grid lg:grid-cols-4 lg:gap-4 xl:gap-5">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className={`group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${s.highlight ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25' : 'shadow-md hover:shadow-lg'}`}>
                  {/* Decorative circle */}
                  <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full ${s.highlight ? 'bg-white/10' : 'bg-gray-50'} transition-transform duration-300 group-hover:scale-110`} />
                  <div className="relative">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.grad} text-white shadow-lg shadow-gray-200/50`}>
                      <Icon size={20} />
                    </div>
                    <p className={`mt-4 text-2xl font-bold tracking-tight ${s.highlight ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                    <p className={`mt-0.5 text-xs font-medium ${s.highlight ? 'text-white/75' : 'text-gray-400'}`}>{s.label}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Chart + Transaction History */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-8 lg:gap-5">
          {/* Earnings Chart - 60% */}
          <Card className="relative overflow-hidden p-4 shadow-md transition-all duration-300 hover:shadow-lg lg:col-span-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Earnings Overview</h3>
                <p className="text-[10px] text-gray-400">{periodLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold leading-tight tracking-tight text-gray-900">{inr(periodTotal)}</p>
                <p className="text-[9px] font-medium text-gray-400">
                  {trendPct === null ? (
                    'no data to compare'
                  ) : (
                    <span className={isPositiveTrend ? 'font-bold text-emerald-600' : 'font-bold text-red-500'}>
                      {trendPct >= 0 ? '+' : ''}
                      {trendPct}% vs prev {period}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Period Tabs */}
            <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
              {(['week', 'month', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-all ${
                    period === p ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Vertical Bar Chart (Column Chart) */}
            <div key={period} className="flex min-w-0">
              <div className="min-w-0 flex-1">
                {/* Bars */}
                <div className="relative h-40">
                  <div className={`absolute inset-0 flex items-end ${period === 'month' ? 'gap-px' : 'gap-1.5'}`}>
                    {chartBars.map(({ label, amount }, idx) => {
                      const isToday =
                        period === 'week'
                          ? idx === (now.getDay() + 6) % 7
                          : period === 'month'
                          ? Number(label) === todayDate
                          : idx === todayMonth;
                      const isBest = amount === maxBarAmount && amount > 0 && !isToday;
                      const heightPct = amount > 0 ? Math.max(4, Math.round((amount / periodMax) * 100)) : 0;

                      return (
                        <div key={label} className="group/bar relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end">
                          {/* Tooltip, floats above the bar top */}
                          <div
                            style={{ bottom: `calc(${heightPct}% + 6px)` }}
                            className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[9px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/bar:opacity-100"
                          >
                            {period === 'month' ? `${MONTH_KEYS[todayMonth]} ${label} · ` : ''}
                            {inr(amount)}
                          </div>
                          {/* Column bar (only for days/dates/months with earnings) */}
                          {amount > 0 && (
                            <div
                              className={`bar-rise w-full max-w-7 rounded-t-md ${
                                isToday
                                  ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 shadow-md shadow-emerald-300'
                                  : isBest
                                  ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-md shadow-emerald-200'
                                  : 'bg-gradient-to-t from-emerald-400/80 to-emerald-300/80'
                              }`}
                              style={{
                                height: `${heightPct}%`,
                                animationDelay: `${Math.min(idx * 30, 500)}ms`,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className={`mt-1.5 flex ${period === 'month' ? 'gap-px' : 'gap-1.5'}`}>
                  {chartBars.map(({ label }, idx) => {
                    const isToday =
                      period === 'week'
                        ? idx === (now.getDay() + 6) % 7
                        : period === 'month'
                        ? Number(label) === todayDate
                        : idx === todayMonth;
                    const showLabel =
                      period !== 'month' || idx === 0 || idx === chartBars.length - 1 || Number(label) % 5 === 0 || isToday;
                    return (
                      <span
                        key={label}
                        className={`min-w-0 flex-1 truncate text-center text-[8px] leading-none ${
                          isToday ? 'font-bold text-emerald-600' : 'text-gray-400'
                        }`}
                      >
                        {showLabel ? label : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart footer: best day & daily average */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2.5 text-[10px]">
              <span className="text-gray-400">
                <span className="font-bold text-emerald-600">
                  {period === 'month' ? `Day ${bestBar.label}` : bestBar.label}
                </span>{' '}
                earned the most
              </span>
              <span className="text-gray-400">
                Avg <span className="font-bold text-gray-900">{inr(avgPerBar)}</span>/{period === 'year' ? 'mo' : 'day'}
              </span>
            </div>
          </Card>

          {/* Quick Stats - 40% */}
          <Card className="relative overflow-hidden p-4 shadow-md transition-all duration-300 hover:shadow-lg lg:col-span-3">
            <h3 className="text-sm font-bold text-gray-900">Performance</h3>
            <p className="text-[10px] text-gray-400">Key metrics</p>
            <div className="mt-4 space-y-2">
              {[
                { icon: Icons.CheckCircle2, label: 'Jobs Completed', value: completed.length, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                { icon: Icons.Star, label: 'Avg. Rating', value: avgRating ? avgRating.toFixed(1) : '—', bg: 'bg-amber-50', text: 'text-amber-600' },
                { icon: Icons.ArrowDownToLine, label: 'Withdrawn', value: inr(withdrawn), bg: 'bg-violet-50', text: 'text-violet-600' },
                { icon: Icons.Wallet, label: 'Available', value: inr(available), bg: 'bg-sky-50', text: 'text-sky-600' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="group flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bg}`}>
                        <Icon size={16} className={item.text} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Transaction History */}
        <div className="mt-4 lg:mt-6">
          <h3 className="mb-3 text-sm font-bold text-gray-900 lg:text-base">Recent Transactions</h3>
          {loading ? (
            <Spinner className="py-8" />
          ) : completed.length === 0 ? (
            <Card className="p-8 text-center shadow-md">
              <EmptyState icon={<Icons.Wallet size={32} />} title="No earnings yet" subtitle="Complete jobs to start earning." />
            </Card>
          ) : (
            <Card className="overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="px-5 py-3.5 font-semibold">Service</th>
                      <th className="px-5 py-3.5 font-semibold">Customer</th>
                      <th className="px-5 py-3.5 font-semibold hidden md:table-cell">Date</th>
                      <th className="px-5 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.slice(0, 10).map((b, i) => (
                      <tr key={b.id} className={`group transition-colors hover:bg-emerald-50/30 ${i !== completed.slice(0, 10).length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900">{b.service_name}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-500">{b.customer_name}</td>
                        <td className="px-5 py-4 text-gray-400 hidden md:table-cell">{formatDate(b.scheduled_date)}</td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-600">+{inr(b.total_amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showStatement && (
        <div className="absolute inset-0 z-40 flex flex-col bg-gray-50">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-3">
            <button onClick={() => setShowStatement(false)} className="text-gray-400"><Icons.X size={22} /></button>
            <p className="flex-1 text-base font-bold text-gray-900">Statement</p>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar space-y-2 p-4">
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