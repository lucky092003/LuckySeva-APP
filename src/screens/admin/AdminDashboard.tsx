import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Card, Spinner, Badge } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Booking, Professional } from '@/lib/types';

export const AdminDashboard = () => {
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

  const revenue = bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + Number(b.total_amount), 0);
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const active = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).length;

  const stats = [
    { label: 'Total Revenue', value: inr(revenue), icon: Icons.IndianRupee, color: 'emerald', change: '+12%' },
    { label: 'Total Bookings', value: `${bookings.length}`, icon: Icons.CalendarCheck, color: 'sky', change: '+8%' },
    { label: 'Active Jobs', value: `${active}`, icon: Icons.Activity, color: 'amber', change: '+3%' },
    { label: 'Providers', value: `${pros.length}`, icon: Icons.Wrench, color: 'violet', change: '+2' },
    { label: 'Completed', value: `${completed}`, icon: Icons.CheckCircle2, color: 'emerald', change: '+15%' },
    { label: 'Customers', value: '1,240', icon: Icons.Users, color: 'rose', change: '+9%' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-extrabold text-gray-900">Admin Dashboard</h1>
          <p className="text-[11px] text-gray-500">LuckySeva Platform Overview</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-3.5">
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[s.color]}`}>
                  <Icon size={18} />
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{s.change}</span>
              </div>
              <p className="mt-2 text-lg font-extrabold text-gray-900">{s.value}</p>
              <p className="text-[11px] text-gray-500">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Revenue chart */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Revenue This Week</h3>
        <div className="flex h-28 items-end justify-between gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
            const h = [55, 40, 70, 45, 85, 95, 60][i];
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full overflow-hidden rounded-t-md bg-gray-100" style={{ height: '100%' }}>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400" style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
                </div>
                <span className="text-[9px] text-gray-400">{day}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent bookings */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-bold text-gray-900">Recent Bookings</h3>
        <Card className="divide-y divide-gray-50">
          {bookings.slice(0, 5).map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                {b.customer_name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{b.service_name}</p>
                <p className="text-[10px] text-gray-400">{b.customer_name} · {formatDate(b.scheduled_date)}</p>
              </div>
              <Badge tone={b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'neutral' : 'info'}>
                {b.status.replace('_', ' ')}
              </Badge>
              <span className="text-xs font-bold text-emerald-600">{inr(b.total_amount)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Top providers */}
      <div className="mt-4 mb-2">
        <h3 className="mb-2 text-sm font-bold text-gray-900">Top Providers</h3>
        <Card className="divide-y divide-gray-50">
          {[...pros].sort((a, b) => b.rating - a.rating).slice(0, 4).map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full bg-gray-100 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{p.name}</p>
                <p className="text-[10px] text-gray-400">{p.completed_jobs} jobs</p>
              </div>
              <div className="flex items-center gap-1">
                <Icons.Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-bold text-gray-700">{p.rating}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
