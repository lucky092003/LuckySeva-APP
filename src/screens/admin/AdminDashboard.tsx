import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/app-context';
import { Card, Spinner, Badge } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Booking, BookingStatus, Professional } from '@/lib/types';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY = [1, 2, 3, 4, 5, 6, 0];

const STATUS_FLOW: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'started', 'completed', 'cancelled'];

const STATUS_TONE: Record<BookingStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  confirmed: 'info',
  assigned: 'info',
  on_the_way: 'warning',
  started: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const startOfWeek = (d: Date) => {
  const day = startOfDay(d);
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return monday;
};

const weekRevenue = (bookings: Booking[], start: Date, out: number[]) => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  bookings.forEach((b) => {
    if (b.status === 'cancelled') return;
    const d = startOfDay(new Date(b.scheduled_date + 'T00:00:00'));
    if (d >= start && d < end) {
      const idx = WEEKDAY[d.getDay()];
      out[idx] += Number(b.total_amount) || 0;
    }
  });
};

export const AdminDashboard = () => {
  const { navigate } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('professionals').select('*'),
    ]).then(([b, p]) => {
      setBookings((b.data as Booking[]) || []);
      setPros((p.data as Professional[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const exportCsv = async () => {
    const rows = bookings.map((b) => ({
      id: b.id,
      service: b.service_name,
      customer: b.customer_name,
      phone: b.customer_phone,
      professional: b.professional_name,
      date: b.scheduled_date,
      time: b.scheduled_time,
      amount: b.total_amount,
      payment_method: b.payment_method,
      payment_status: b.payment_status,
      status: b.status,
    }));
    const headers = Object.keys(rows[0] || {});
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc((r as Record<string, unknown>)[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luckyseva-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await supabase.from('audit_logs').insert({ action: 'export', detail: `Exported ${rows.length} bookings to CSV` });
  };

  const revenue = bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + Number(b.total_amount), 0);
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const active = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).length;
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const statusCounts = STATUS_FLOW.map((s) => ({
    status: s,
    count: bookings.filter((b) => b.status === s).length,
  }));
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  const thisWeek = startOfWeek(new Date());
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const weekly = [0, 0, 0, 0, 0, 0, 0];
  const previousWeekly = [0, 0, 0, 0, 0, 0, 0];
  weekRevenue(bookings, thisWeek, weekly);
  weekRevenue(bookings, lastWeek, previousWeekly);

  const thisWeekTotal = weekly.reduce((s, x) => s + x, 0);
  const lastWeekTotal = previousWeekly.reduce((s, x) => s + x, 0);
  const weekDelta =
    lastWeekTotal > 0
      ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
      : thisWeekTotal > 0
      ? 100
      : 0;
  const weekDeltaLabel = `${weekDelta >= 0 ? '+' : ''}${weekDelta.toFixed(1)}% vs last week`;
  const maxDay = Math.max(1, ...weekly);

  const stats = [
    { label: 'Total Revenue', value: inr(revenue), icon: Icons.IndianRupee, grad: 'from-emerald-500 to-teal-600' },
    { label: 'Total Bookings', value: `${bookings.length}`, icon: Icons.CalendarCheck, grad: 'from-sky-500 to-blue-600' },
    { label: 'Active Jobs', value: `${active}`, icon: Icons.Activity, grad: 'from-amber-500 to-orange-600' },
    { label: 'Service Providers', value: `${pros.length}`, icon: Icons.Wrench, grad: 'from-violet-500 to-purple-600' },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50">
            <Icons.Download size={14} /> Export
          </button>
          <button
            onClick={() => navigate({ name: 'admin-bookings' })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
          >
            <Icons.Plus size={14} /> View Bookings
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.grad} text-white shadow-md`}>
                    <Icon size={20} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Revenue This Week</h3>
                <p className="text-xs text-gray-500">Daily earnings across the platform</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-gray-900">{inr(thisWeekTotal)}</p>
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <Icons.TrendingUp size={11} /> {weekDeltaLabel}
                </p>
              </div>
            </div>
            <div className="flex h-48 items-end justify-between gap-3">
              {WEEK.map((day, i) => {
                const value = weekly[i];
                const h = maxDay > 0 ? (value / maxDay) * 100 : 0;
                return (
                  <div key={day} className="group flex flex-1 flex-col items-center gap-2">
                    <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {inr(value)}
                    </span>
                    <div className="relative w-full overflow-hidden rounded-lg bg-gray-100" style={{ height: '130px' }}>
                      <div
                        className="absolute bottom-0 w-full rounded-lg bg-gradient-to-t from-emerald-500 to-teal-400 transition-all group-hover:from-emerald-600 group-hover:to-teal-500"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500">{day}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-gray-900">Booking Status</h3>
            <p className="text-xs text-gray-500">Distribution by stage</p>
            <div className="mt-4 space-y-3">
              {statusCounts.map((s) => (
                <div key={s.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium capitalize text-gray-700">{s.status.replace('_', ' ')}</span>
                    <span className="font-bold text-gray-900">{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${
                        s.status === 'completed'
                          ? 'bg-emerald-500'
                          : s.status === 'cancelled'
                          ? 'bg-red-400'
                          : s.status === 'on_the_way' || s.status === 'started'
                          ? 'bg-amber-400'
                          : 'bg-sky-400'
                      }`}
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3">
              <div>
                <p className="text-xs font-bold text-gray-900">{completed}</p>
                <p className="text-[10px] text-gray-500">Completed</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{bookings.length - completed}</p>
                <p className="text-[10px] text-gray-500">Not completed</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-bold text-gray-900">Recent Bookings</h3>
              <button
                onClick={() => navigate({ name: 'admin-bookings' })}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3 font-semibold">Service</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 6).map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900">{b.service_name}</p>
                        <p className="text-[11px] text-gray-400">{b.professional_name}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{b.customer_name}</td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(b.scheduled_date)}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">{inr(b.total_amount)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[b.status]}>{b.status.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-bold text-gray-900">Top Providers</h3>
              <button
                onClick={() => navigate({ name: 'admin-providers' })}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all →
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {[...pros].sort((a, b) => b.rating - a.rating).slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-4 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                  <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-lg bg-gray-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-900">{p.name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{p.category_slug.replace('-', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-gray-700">{p.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};