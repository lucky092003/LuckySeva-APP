import { Search, MapPin, ChevronRight, Star, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { useCategories, usePopularServices } from '@/hooks';
import { api } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';
import { isNative } from '@/utils/native';
import { Card, Spinner, SectionTitle } from '@/components/ui';
import { inr, formatRelativeDay } from '@/utils/format';
import type { Professional, Booking } from '@/types';
import { DesktopHomeScreen } from '@/screens/customer/DesktopHomeScreen';

export const HomeScreen = () => {
  const { navigate, customer, setCustomer } = useApp();
  const { categories, loading: catLoading } = useCategories();
  const { popularServices, loading: svcLoading } = usePopularServices();
  const [topPros, setTopPros] = useState<Professional[]>([]);
  const [proLoading, setProLoading] = useState(true);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [locating, setLocating] = useState(false);
  const [isDesktopWeb, setIsDesktopWeb] = useState(
    () => !isNative && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    if (isNative) return;
    const media = window.matchMedia('(min-width: 1024px)');
    const updateLayout = () => setIsDesktopWeb(media.matches);
    updateLayout();
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

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

  const desktopProps = {
    categories,
    catLoading,
    popularServices,
    svcLoading,
    topPros,
    proLoading,
    recent,
    name: customer?.name?.split(' ')[0] || 'there',
    location: customer?.location || '',
    locating,
    onLocationClick: handleLocationTap,
    onCategory: (slug: string) => navigate({ name: 'category', slug }),
    onService: (id: string) => navigate({ name: 'service', id }),
    onBooking: (bookingId: string) => navigate({ name: 'tracking', bookingId }),
    onSeeBookings: () => navigate({ name: 'bookings' }),
    onSeeServices: () => navigate({ name: 'services' }),
    onSupport: () => navigate({ name: 'help' }),
    onProfessional: (id: string) => navigate({ name: 'professional', id }),
  };

  if (isDesktopWeb) return <DesktopHomeScreen {...desktopProps} />;

  return (
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar bg-gray-50">
      {/* Premium customer hero */}
      <section className="relative isolate shrink-0 overflow-hidden bg-[linear-gradient(135deg,#d8eee1_0%,#eaf4ed_58%,#cfe7d8_100%)] px-5 pb-6 pt-4 text-slate-950 md:px-8 md:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-32 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -left-24 bottom-[-8rem] h-64 w-64 rounded-full bg-teal-200/20 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleLocationTap}
              className="flex min-w-0 items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3 py-2 text-left text-slate-700 shadow-sm shadow-emerald-900/5 backdrop-blur-md transition hover:border-emerald-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <MapPin size={14} />
              </span>
              <span className="min-w-0 max-w-[220px] truncate text-xs font-semibold text-slate-700 md:max-w-sm">
                {locating ? 'Finding your location…' : customer?.location || 'Choose your location'}
              </span>
              <ChevronRight size={14} className="shrink-0 text-slate-400" />
            </button>
            <button
              onClick={() => navigate({ name: 'notifications' })}
              aria-label="Notifications"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/75 text-emerald-700 shadow-sm backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
            >
              <Icons.Bell size={18} />
            </button>
          </div>

          <div className="mt-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] md:items-center md:gap-10">
            <div>
              <h1 className="max-w-xl text-[34px] font-extrabold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-4xl md:text-5xl">
                Home care,<br className="sm:hidden" />{' '}
                <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent">made effortless.</span>
              </h1>
              <p className="mt-2.5 max-w-lg text-sm leading-6 text-slate-600 md:mt-4 md:text-base md:leading-7">
                Trusted local professionals for repairs, cleaning, and everything your home needs.
              </p>
            </div>

            <div className="mt-4 md:mt-0">
              <button
                onClick={() => navigate({ name: 'search' })}
                aria-label="Search home services"
                className="group flex w-full items-center gap-3 rounded-2xl border border-white bg-white p-2.5 pl-4 text-left shadow-[0_16px_38px_-22px_rgba(6,78,59,0.3)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-20px_rgba(6,78,59,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#d8eee1] active:scale-[0.99] md:p-3 md:pl-5"
              >
                <Search size={19} className="shrink-0 text-emerald-700" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">What service do you need?</span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-900/20 transition group-hover:translate-x-0.5 group-hover:shadow-lg">
                  <Icons.ArrowRight size={18} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <div className="mx-auto w-full max-w-7xl px-5 pt-5 md:px-8 md:pt-7">
        <SectionTitle title="Service Categories" />
        {catLoading ? (
          <Spinner className="py-8" />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-5">
            {categories.map((cat) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[cat.icon] || Icons.Circle;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate({ name: 'category', slug: cat.slug })}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm shadow-gray-100/70 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:p-4 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110 md:h-16 md:w-16"
                    style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}
                  >
                    <Icon size={26} className="text-white" />
                  </div>
                  <span className="text-center text-[11px] font-bold leading-tight text-gray-800 md:text-xs dark:text-gray-200">{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popular services */}
      <div className="mx-auto w-full max-w-7xl px-5 pt-6 md:px-8 md:pt-8">
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
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm shadow-gray-100/70 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none"
                  style={{ background: `linear-gradient(160deg, ${color}18 0%, #ffffff 55%)` }}
                >
                  <div
                    className="pointer-events-none absolute -right-4 -top-4 opacity-[0.12] transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 dark:opacity-[0.18]"
                    style={{ color }}
                  >
                    <Icon size={58} />
                  </div>
                  <div className="relative">
                    <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl shadow-md ring-1 ring-white/40" style={{ background: `linear-gradient(135deg, ${color}, ${color}c0)` }}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <p className="text-sm font-extrabold leading-snug text-gray-900 dark:text-gray-100">{svc.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{svc.estimated_duration}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{inr(svc.starting_price)}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">onwards</span>
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
        <div className="mx-auto w-full max-w-7xl px-5 pt-6 md:px-8 md:pt-8">
          <SectionTitle title="Your Recent Bookings" action="See all" onAction={() => navigate({ name: 'bookings' })} />
          <div className="grid gap-2 md:grid-cols-2">
            {recent.slice(0, 2).map((b) => (
              <Card key={b.id} onClick={() => navigate({ name: 'tracking', bookingId: b.id })} className="flex items-center gap-3 p-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 text-slate-500 ring-1 ring-gray-100 dark:from-gray-800 dark:to-gray-900 dark:text-slate-400 dark:ring-gray-800">
                  <Calendar size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{b.service_name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{b.professional_name} · {formatRelativeDay(b.scheduled_date)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : b.status === 'cancelled' ? 'bg-gray-100 text-slate-600 dark:bg-gray-800 dark:text-slate-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'}`}>
                  {b.status.replace('_', ' ')}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top rated professionals */}
      <div className="mx-auto w-full max-w-7xl px-5 pb-6 pt-6 md:px-8 md:pb-10 md:pt-8">
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
