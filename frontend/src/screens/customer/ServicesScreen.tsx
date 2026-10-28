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
  const [search, setSearch] = useState('');

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
    const category = activeCategory === 'all'
      ? null
      : categories.find((c) => c.slug === activeCategory || c.id === activeCategory);
    const query = search.trim().toLocaleLowerCase();

    return services.filter((service) => {
      const matchesCategory = !category || service.category_id === category.id;
      const matchesSearch = !query || service.name.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, categories, search, services]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f7f8f7]">
      <TopBar title="All Services" showBack={false} />

      <div className="shrink-0 border-b border-slate-200/70 bg-white px-5 pb-4 pt-1 lg:px-[25px]">
        <div className="mx-auto w-full">
          <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
            <Icons.Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Search services"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="What service do you need?"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <Icons.X size={15} />
              </button>
            )}
          </label>

          {categories.length > 0 && (
            <div className="no-scrollbar -mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 pb-0.5 lg:mx-0 lg:flex-wrap lg:overflow-x-visible lg:px-0">
              <button
                onClick={() => setActiveCategory('all')}
                aria-pressed={activeCategory === 'all'}
                className={`flex h-9 shrink-0 items-center rounded-full px-4 text-xs font-semibold transition ${activeCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800'}`}
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
                    aria-pressed={isActive}
                    className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition ${isActive ? 'bg-emerald-700 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800'}`}
                  >
                    <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
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
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900">
                    {activeCategory === 'all' ? 'Explore services' : categories.find((category) => category.slug === activeCategory || category.id === activeCategory)?.name || 'Services'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Find the right help for your home</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {visibleServices.length} {visibleServices.length === 1 ? 'service' : 'services'}
                </span>
              </div>
              {visibleServices.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visibleServices.map((svc) => {
                    const cat = categories.find((c) => c.id === svc.category_id);
                    const color = cat?.color || '#10b981';
                    const Icon = cat ? iconFor(cat.icon) : Icons.Circle;
                    return (
                      <button
                        key={svc.id}
                        onClick={() => navigate({ name: 'service', id: svc.id })}
                        className="group flex min-h-[158px] h-full flex-col items-start rounded-[20px] border border-slate-200/80 bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:min-h-[170px] sm:p-4"
                      >
                        <div className="mb-3 flex w-full items-center justify-between">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] sm:h-11 sm:w-11"
                            style={{ backgroundColor: `${color}18`, color }}
                          >
                            <Icon size={20} />
                          </span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
                            <Icons.ArrowUpRight size={15} />
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 sm:text-sm">{svc.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                          <Icons.Clock3 size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{svc.estimated_duration}</span>
                        </p>
                        <div className="mt-auto flex w-full items-end justify-between border-t border-slate-100 pt-2.5">
                          <span className="text-[10px] font-medium text-slate-400">Starting at</span>
                          <span className="text-sm font-extrabold tracking-tight text-emerald-700">{inr(svc.starting_price)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Icons.SearchX size={28} />}
                  title={search ? 'No matching services' : 'No services in this category'}
                  subtitle={search ? 'Try another service name or browse a category.' : 'Browse other categories'}
                />
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
