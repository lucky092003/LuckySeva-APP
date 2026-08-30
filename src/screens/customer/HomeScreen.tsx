import { Search, MapPin, Bell, ChevronRight, Percent, Star, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/app-context';
import { useCategories, usePopularServices, useUnreadNotifications } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, SectionTitle } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Professional, Booking } from '@/lib/types';

const OFFERS = [
  { title: 'Flat 20% off first booking', code: 'LUCKY20', grad: 'from-amber-400 to-orange-500' },
  { title: '₹50 off on any service', code: 'SEVA50', grad: 'from-violet-500 to-purple-600' },
  { title: '₹100 off cleaning services', code: 'CLEAN100', grad: 'from-sky-500 to-blue-600' },
];

export const HomeScreen = () => {
  const { navigate, customer } = useApp();
  const { categories, loading: catLoading } = useCategories();
  const { popularServices, loading: svcLoading } = usePopularServices();
  const { unread } = useUnreadNotifications(customer?.phone || null);
  const [topPros, setTopPros] = useState<Professional[]>([]);
  const [proLoading, setProLoading] = useState(true);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const [savedCoupon, setSavedCoupon] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('professionals')
      .select('*')
      .order('rating', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setTopPros((data as Professional[]) || []);
        setProLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!customer?.phone) return;
    supabase
      .from('bookings')
      .select('*')
      .eq('customer_phone', customer.phone)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecent((data as Booking[]) || []));
  }, [customer]);

  // Auto-rotate offers
  useEffect(() => {
    const t = setInterval(() => setOfferIdx((i) => (i + 1) % OFFERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const offer = OFFERS[offerIdx];

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard unavailable */
    }
    setSavedCoupon(code);
    setTimeout(() => setSavedCoupon(null), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pb-6 pt-4 text-white">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate({ name: 'addresses' })} className="flex items-center gap-1.5">
            <MapPin size={16} />
            <span className="text-sm font-semibold">
              {customer?.location || 'Koramangala, Bangalore'}
            </span>
            <ChevronRight size={16} />
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

      {/* Offers carousel */}
      <div className="-mt-3 px-5">
        <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r ${offer.grad} p-4 text-white shadow-md transition-all duration-500`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            <Percent size={22} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{offer.title}</p>
            <button
              onClick={() => copyCode(offer.code)}
              className="mt-0.5 text-xs text-white/90 underline"
            >
              {savedCoupon === offer.code ? 'Copied!' : `Use code ${offer.code}`}
            </button>
          </div>
        </div>
        {/* Dots */}
        <div className="mt-2 flex justify-center gap-1.5">
          {OFFERS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === offerIdx ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-300'}`} />
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 pt-5">
        <SectionTitle title="Service Categories" />
        {catLoading ? (
          <Spinner className="py-8" />
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {categories.map((cat) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[cat.icon] || Icons.Circle;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate({ name: 'category', slug: cat.slug })}
                  className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
                    style={{ backgroundColor: cat.color + '18' }}
                  >
                    <Icon size={26} />
                  </div>
                  <span
                    className="text-center text-[10px] font-semibold leading-tight"
                    style={{ color: cat.color }}
                  >
                    {cat.name}
                  </span>
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
          <div className="grid grid-cols-2 gap-3">
            {popularServices.slice(0, 4).map((svc) => {
              const cat = (svc as unknown as { category: { color: string; icon: string; name: string } }).category;
              const color = cat?.color || '#10b981';
              const Icon = cat ? (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[cat.icon] || Icons.Circle : Icons.Circle;
              return (
                <Card
                  key={svc.id}
                  onClick={() => navigate({ name: 'service', id: svc.id })}
                  className="overflow-hidden p-3.5"
                >
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: color + '18' }}>
                    <Icon size={20} />
                  </div>
                  <p className="text-sm font-bold leading-snug text-gray-900">{svc.name}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{svc.estimated_duration}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-600">{inr(svc.starting_price)}</span>
                    <span className="text-[10px] text-gray-400">onwards</span>
                  </div>
                </Card>
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
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
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
