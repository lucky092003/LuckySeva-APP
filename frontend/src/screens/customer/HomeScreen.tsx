import { Search, MapPin, Bell, ChevronRight, Star, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { useCategories, usePopularServices, useUnreadNotifications } from '@/hooks';
import { api } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';
import { Card, Spinner, SectionTitle } from '@/components/ui';
import { inr, formatRelativeDay } from '@/utils/format';
import type { Professional, Booking } from '@/types';

export const HomeScreen = () => {
  const { navigate, customer, setCustomer } = useApp();
  const { categories, loading: catLoading } = useCategories();
  const { popularServices, loading: svcLoading } = usePopularServices();
  const { unread } = useUnreadNotifications(customer?.phone || null);
  const [topPros, setTopPros] = useState<Professional[]>([]);
  const [proLoading, setProLoading] = useState(true);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api.catalog
      .professionals({ limit: 6 })
      .then((data) => setTopPros(data))
      .catch(() => setTopPros([]))
      .finally(() => setProLoading(false));
  }, []);

  useEffect(() => {
    api.customer
      .bookings()
      .then((rows) => setRecent((rows || []).slice(0, 3)))
      .catch(() => setRecent([]));
  }, []);

  const handleLocationTap = async () => {
    if (customer?.location) {
      navigate({ name: 'addresses' });
      return;
    }
    setLocating(true);
    try {
      const loc = await fetchCurrentLocation();
      if (customer?.phone) {
        await api.customer.updateProfile({ location: loc.address }).catch(() => {});
      }
      if (customer) setCustomer({ ...customer, location: loc.address });
      navigate({ name: 'addresses', detected: loc.address });
    } catch {
      navigate({ name: 'addresses' });
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pb-6 pt-4 text-white">
        <div className="flex items-center justify-between">
          <button onClick={handleLocationTap} className="flex min-w-0 items-center gap-1.5 text-left">
            <MapPin size={14} className="shrink-0" />
            <span className="max-w-[160px] truncate text-xs font-medium text-white/90">
              {locating ? 'Detecting location...' : customer?.location || 'Detect my location'}
            </span>
            <ChevronRight size={14} className="shrink-0" />
          </button>
          <button onClick={() => navigate({ name: 'notifications' })} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-gray-900">{unread > 9 ? '9+' : unread}</span>
            )}
          </button>
        </div>
        <h1 className="mt-3 text-xl font-bold">
          Hi {customer?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-sm text-white/80">What service do you need today?</p>

        {/* Search */}
        <button
          onClick={() => navigate({ name: 'search' })}
          className="mt-4 flex w-full items-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-left text-sm text-gray-400 shadow-lg transition-transform active:scale-[0.98]"
        >
          <Search size={18} />
          What service do you need?
        </button>
      </div>

      {/* Categories */}
      <div className="px-5 pt-5">
        <SectionTitle title="Service Categories" />
        {catLoading ? (
          <Spinner className="py-8" />
        ) : (
          <div className="grid grid-cols-4 gap-3 md:grid-cols-8 md:gap-5">
            {categories.map((cat) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[cat.icon] || Icons.Circle;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate({ name: 'category', slug: cat.slug })}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50 p-3 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg md:p-4"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110 md:h-16 md:w-16"
                    style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}
                  >
                    <Icon size={26} className="text-white" />
                  </div>
                  <span className="text-center text-[11px] font-bold leading-tight text-gray-800 md:text-xs">{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popular services */}
      <div className="px-5 pt-6">
        <SectionTitle title="Popular Services" />
        {svcLoading ? (
          <Spinner className="py-8" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {popularServices.slice(0, 4).map((svc) => {
              const cat = categories.find((c) => c.id === svc.category_id);
              const color = cat?.color || '#10b981';
              const Icon = cat ? (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[cat.icon] || Icons.Circle : Icons.Circle;
              return (
                <button
                  key={svc.id}
                  onClick={() => navigate({ name: 'service', id: svc.id })}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-100 hover:shadow-2xl"
                  style={{ background: `linear-gradient(150deg, ${color}30 0%, ${color}0d 45%, #ffffff 100%)` }}
                >
                  <div
                    className="pointer-events-none absolute -right-3 -top-3 opacity-[0.14] transition-transform duration-300 group-hover:rotate-[-10deg] group-hover:scale-110"
                    style={{ color }}
                  >
                    <Icon size={52} />
                  </div>
                  <div className="relative">
                    <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ring-2 ring-white/50" style={{ background: `linear-gradient(135deg, ${color}, ${color}c0)` }}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <p className="text-sm font-extrabold leading-snug text-gray-900">{svc.name}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{svc.estimated_duration}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-base font-extrabold text-emerald-600">{inr(svc.starting_price)}</span>
                      <span className="rounded-full bg-emerald-50/80 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">onwards</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent bookings */}
      {recent.length > 0 && (
        <div className="px-5 pt-6">
          <SectionTitle title="Your Recent Bookings" action="See all" onAction={() => navigate({ name: 'bookings' })} />
          <div className="space-y-2">
            {recent.slice(0, 2).map((b) => (
              <Card key={b.id} onClick={() => navigate({ name: 'tracking', bookingId: b.id })} className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Calendar size={18} className="text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{b.service_name}</p>
                  <p className="text-[11px] text-gray-500">{b.professional_name} · {formatRelativeDay(b.scheduled_date)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : b.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-sky-50 text-sky-600'}`}>
                  {b.status.replace('_', ' ')}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top rated professionals */}
      <div className="px-5 pt-6 pb-6">
        <SectionTitle title="Top Rated Near You" />
        {proLoading ? (
          <Spinner className="py-6" />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar md:flex-wrap md:overflow-visible">
            {topPros.map((pro) => {
              const cat = categories.find((c) => c.slug === pro.category_slug);
              return (
                <button
                  key={pro.id}
                  onClick={() => navigate({ name: 'professional', id: pro.id })}
                  className="w-36 shrink-0 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: cat?.color || '#10b981' }}>
                    {pro.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <p className="truncate text-xs font-bold text-gray-900">{pro.name}</p>
                  <p className="text-[10px] text-gray-500">{cat?.name || pro.category_slug}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-[11px] font-semibold text-gray-700">{pro.rating}</span>
                    <span className="text-[10px] text-gray-400">· {pro.completed_jobs}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
