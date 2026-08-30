import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Card, Spinner, Badge, EmptyState } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Booking } from '@/lib/types';

export const AdminCustomers = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('bookings').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setBookings((data as Booking[]) || []);
      setLoading(false);
    });
  }, []);

  // Group by customer phone
  const customers = Object.values(
    bookings.reduce<Record<string, { name: string; phone: string; count: number; spent: number; lastDate: string }>>((acc, b) => {
      const key = b.customer_phone;
      if (!acc[key]) acc[key] = { name: b.customer_name, phone: b.customer_phone, count: 0, spent: 0, lastDate: b.scheduled_date };
      acc[key].count += 1;
      if (b.status !== 'cancelled') acc[key].spent += Number(b.total_amount);
      if (b.scheduled_date > acc[key].lastDate) acc[key].lastDate = b.scheduled_date;
      return acc;
    }, {})
  );

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-extrabold text-gray-900">Customers</h1>
          <p className="text-[11px] text-gray-500">{customers.length} registered customers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-lg font-extrabold text-gray-900">{customers.length}</p>
          <p className="text-[10px] text-gray-500">Total</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-extrabold text-emerald-600">{bookings.length}</p>
          <p className="text-[10px] text-gray-500">Bookings</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-extrabold text-sky-600">{inr(customers.reduce((s, c) => s + c.spent, 0))}</p>
          <p className="text-[10px] text-gray-500">Revenue</p>
        </Card>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={<Icons.Users size={28} />} title="No customers yet" />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Card key={c.phone} className="flex items-center gap-3 p-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
                {c.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                <p className="text-[11px] text-gray-500">{c.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">{inr(c.spent)}</p>
                <p className="text-[10px] text-gray-400">{c.count} bookings</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminProviders = () => {
  const [pros, setPros] = useState<import('@/lib/types').Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('professionals').select('*').order('rating', { ascending: false }).then(({ data }) => {
      setPros((data as import('@/lib/types').Professional[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-extrabold text-gray-900">Service Providers</h1>
          <p className="text-[11px] text-gray-500">{pros.length} professionals</p>
        </div>
      </div>

      <div className="space-y-2">
        {pros.map((p) => (
          <Card key={p.id} className="p-3.5">
            <div className="flex items-center gap-3">
              <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-xl bg-gray-100 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-gray-900">{p.name}</p>
                  <Icons.BadgeCheck size={14} className="text-emerald-500" />
                </div>
                <p className="text-[11px] text-gray-500 capitalize">{p.category_slug.replace('-', ' ')}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-gray-700">{p.rating}</span>
                </div>
                <p className="text-[10px] text-gray-400">{p.completed_jobs} jobs</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2 border-t border-gray-50 pt-2.5">
              <Badge tone={p.status === 'available' ? 'success' : 'warning'}>
                {p.status === 'available' ? 'Available' : 'Busy'}
              </Badge>
              <Badge tone="info">{p.experience_years} yrs exp</Badge>
              <span className="ml-auto text-xs font-bold text-emerald-600">{inr(p.starting_price)}+</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const AdminServices = () => {
  const [cats, setCats] = useState<import('@/lib/types').Category[]>([]);
  const [services, setServices] = useState<import('@/lib/types').Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('services').select('*'),
    ]).then(([c, s]) => {
      setCats((c.data as import('@/lib/types').Category[]) || []);
      setServices((s.data as import('@/lib/types').Service[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const filtered = activeCat ? services.filter((s) => s.category_id === activeCat) : services;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-extrabold text-gray-900">Services & Categories</h1>
          <p className="text-[11px] text-gray-500">{cats.length} categories · {services.length} services</p>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${!activeCat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
        >
          All
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${activeCat === c.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto space-y-2">
        {filtered.map((s) => {
          const cat = cats.find((c) => c.id === s.category_id);
          return (
            <Card key={s.id} className="flex items-center gap-3 p-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: cat?.color || '#10b981' }}>
                <Icons.Wrench size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{s.name}</p>
                <p className="text-[11px] text-gray-500">{cat?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">{inr(s.starting_price)}</p>
                <p className="text-[10px] text-gray-400">{s.estimated_duration}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    supabase.from('bookings').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setBookings((data as Booking[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const filters = ['all', 'confirmed', 'assigned', 'on_the_way', 'started', 'completed', 'cancelled'];
  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const tone: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    confirmed: 'info', assigned: 'info', on_the_way: 'warning', started: 'warning', completed: 'success', cancelled: 'neutral',
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-extrabold text-gray-900">All Bookings</h1>
          <p className="text-[11px] text-gray-500">{bookings.length} total bookings</p>
        </div>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <EmptyState icon={<Icons.CalendarCheck size={28} />} title="No bookings" />
        ) : (
          filtered.map((b) => (
            <Card key={b.id} className="p-3.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                  <p className="text-[11px] text-gray-500">{b.customer_name} · {b.professional_name}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{inr(b.total_amount)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Icons.Calendar size={10} />{formatDate(b.scheduled_date)}</span>
                <span className="flex items-center gap-1"><Icons.Clock size={10} />{b.scheduled_time}</span>
                <Badge tone={tone[b.status]}>{b.status.replace('_', ' ')}</Badge>
                <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 font-semibold uppercase">{b.payment_method}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
