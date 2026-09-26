import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Spinner, EmptyState, SearchBar } from '@/components/ui';
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
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([api.catalog.categories(), api.catalog.services()])
      .then(([c, s]) => {
        setCategories(c || []);
        setServices(s || []);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const q = query.toLowerCase().trim();

  const matchedCats = useMemo(
    () => (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [categories, q]
  );

  const matchedServices = useMemo(
    () => (q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services),
    [services, q]
  );

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of services) map.set(s.category_id, (map.get(s.category_id) || 0) + 1);
    return map;
  }, [services]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="All Services" showBack={false} />

      <div className="shrink-0 border-b border-gray-100 bg-white px-5 pb-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Search services or categories" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
        {loading ? (
          <Spinner className="py-10" />
        ) : failed ? (
          <EmptyState icon={<Icons.WifiOff size={28} />} title="Couldn't load services" subtitle="Pull to refresh or check your connection" />
        ) : (
          <>
            {matchedCats.length > 0 && (
              <>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-gray-400">Categories</p>
                <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {matchedCats.map((cat, i) => {
                    const Icon = iconFor(cat.icon);
                    const count = countByCategory.get(cat.id) || 0;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => navigate({ name: 'category', slug: cat.slug })}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}
                        >
                          <Icon size={20} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">{cat.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {count > 0 ? `${count} service${count > 1 ? 's' : ''}` : cat.description || 'Explore'}
                          </p>
                        </div>
                        <Icons.ChevronRight size={18} className="shrink-0 text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {matchedServices.length > 0 && (
              <>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-gray-400">All Services</p>
                <div className="grid grid-cols-2 gap-3 pb-4 md:grid-cols-3">
                  {matchedServices.map((svc) => {
                    const cat = categories.find((c) => c.id === svc.category_id);
                    const color = cat?.color || '#10b981';
                    const Icon = cat ? iconFor(cat.icon) : Icons.Circle;
                    return (
                      <button
                        key={svc.id}
                        onClick={() => navigate({ name: 'service', id: svc.id })}
                        className="flex flex-col items-start rounded-2xl border border-gray-100 p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-md"
                        style={{ background: `linear-gradient(150deg, ${color}26 0%, ${color}08 45%, #ffffff 100%)` }}
                      >
                        <div
                          className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${color}, ${color}c0)` }}
                        >
                          <Icon size={20} className="text-white" />
                        </div>
                        <p className="text-sm font-bold leading-snug text-gray-900">{svc.name}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">{svc.estimated_duration}</p>
                        <p className="mt-2 text-sm font-extrabold text-emerald-600">{inr(svc.starting_price)}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {matchedCats.length === 0 && matchedServices.length === 0 && (
              <EmptyState icon={<Icons.SearchX size={28} />} title={`No results for "${query}"`} subtitle="Try a different keyword" />
            )}
          </>
        )}
      </div>
    </div>
  );
};
