import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Spinner, EmptyState } from '@/components/ui';
import { inr } from '@/utils/format';
import type { Category, Service } from '@/types';

const iconFor = (name: string) =>
  (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] || Icons.Circle;

export const ServicesScreen = () => {
  const { navigate } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    Promise.all([api.catalog.categories(), api.catalog.services()])
      .then(([c, s]) => {
        setCategories(c || []);
        setServices(s || []);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const visibleServices = useMemo(() => {
    if (activeCategory === 'all') return services;
    const cat = categories.find((c) => c.slug === activeCategory || c.id === activeCategory);
    if (!cat) return services;
    return services.filter((s) => s.category_id === cat.id);
  }, [activeCategory, categories, services]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f7f8f7]">
      <TopBar title="All Services" showBack={false} />

      <div className="shrink-0 border-b border-slate-200/70 bg-white px-5 pb-3 pt-1 lg:px-[25px]">
        <div className="mx-auto flex w-full">
          {categories.length > 0 && (
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:overflow-x-visible">
              <button
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${activeCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800'}`}
              >
                All
              </button>
              {categories.map((cat) => {
                const Icon = iconFor(cat.icon);
                const isActive = activeCategory === cat.slug || activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.slug)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${isActive ? 'bg-emerald-700 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800'}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isActive ? 'bg-white/15' : 'bg-slate-50'}`}>
                      <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
                    </span>
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 lg:px-[25px] lg:py-7">
        <div className="mx-auto w-full">
          {loading ? (
            <Spinner className="py-10" />
          ) : failed ? (
            <EmptyState icon={<Icons.WifiOff size={28} />} title="Couldn't load services" subtitle="Pull to refresh or check your connection" />
          ) : (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{activeCategory === 'all' ? 'All services' : 'Services'}</p>
                <p className="text-xs text-slate-400">{visibleServices.length} available</p>
              </div>
              {visibleServices.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visibleServices.map((svc) => {
                    const cat = categories.find((c) => c.id === svc.category_id);
                    const color = cat?.color || '#10b981';
                    const Icon = cat ? iconFor(cat.icon) : Icons.Circle;
                    return (
                      <button
                        key={svc.id}
                        onClick={() => navigate({ name: 'service', id: svc.id })}
                        className="group flex h-full flex-col items-start rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg sm:p-4"
                      >
                        <div
                          className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm sm:mb-3 sm:h-11 sm:w-11"
                          style={{ background: `linear-gradient(135deg, ${color}, ${color}c0)` }}
                        >
                          <Icon size={19} className="text-white sm:hidden" />
                          <Icon size={21} className="hidden text-white sm:block" />
                        </div>
                        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 sm:text-sm">{svc.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400 sm:mt-1 sm:text-[11px]">{svc.estimated_duration}</p>
                        <p className="mt-auto pt-2 text-sm font-extrabold text-emerald-700 sm:pt-3">{inr(svc.starting_price)} <span className="text-[10px] font-medium text-slate-400">onwards</span></p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={<Icons.SearchX size={28} />} title="No services in this category" subtitle="Browse other categories" />
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
