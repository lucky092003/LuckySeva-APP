import { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, EmptyState, Stars, Badge } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Service, Professional, Category } from '@/lib/types';

const TRENDING = ['AC Service', 'Deep Cleaning', 'Plumber', 'Salon at Home', 'Electrician'];

export const SearchScreen = () => {
  const { navigate, back } = useApp();
  const [query, setQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('services').select('*, category:categories(*)'),
      supabase.from('professionals').select('*'),
      supabase.from('categories').select('*').order('sort_order'),
    ]).then(([s, p, c]) => {
      setServices((s.data as unknown as Service[]) || []);
      setPros((p.data as Professional[]) || []);
      setCategories((c.data as Category[]) || []);
      setLoading(false);
    });
  }, []);

  const q = query.toLowerCase().trim();
  const matchedServices = useMemo(
    () => (q ? services.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) : []),
    [q, services]
  );
  const matchedPros = useMemo(
    () => (q ? pros.filter((p) => p.name.toLowerCase().includes(q) || p.skills.some((sk) => sk.toLowerCase().includes(q)) || p.category_slug.includes(q)) : []),
    [q, pros]
  );
  const matchedCats = useMemo(
    () => (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [q, categories]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      {/* Search header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button onClick={back} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100">
          <Icons.ChevronLeft size={22} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-2.5">
          <Icons.Search size={18} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What service do you need?"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400">
              <Icons.X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {!q && (
          <>
            {/* Trending searches */}
            <div className="mb-5">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Trending Searches</h3>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm"
                  >
                    <Icons.TrendingUp size={13} className="text-emerald-500" />
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Browse categories */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Browse Categories</h3>
              <div className="space-y-2">
                {matchedCats.map((cat) => {
                  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[cat.icon] || Icons.Circle;
                  return (
                    <Card key={cat.id} onClick={() => navigate({ name: 'category', slug: cat.slug })} className="flex items-center gap-3 p-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: cat.color + '18' }}>
                        <Icon size={20} />
                      </div>
                      <span className="flex-1 text-sm font-semibold text-gray-900">{cat.name}</span>
                      <Icons.ChevronRight size={16} className="text-gray-300" />
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {q && loading && <Spinner className="py-12" />}

        {q && !loading && (
          <>
            {/* Matched services */}
            {matchedServices.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Services ({matchedServices.length})</h3>
                <div className="space-y-2">
                  {matchedServices.map((svc) => {
                    const cat = (svc as unknown as { category: { color: string; icon: string; name: string } }).category;
                    const Icon = cat ? (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[cat.icon] || Icons.Circle : Icons.Circle;
                    return (
                      <Card key={svc.id} onClick={() => navigate({ name: 'service', id: svc.id })} className="flex items-center gap-3 p-3.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: (cat?.color || '#10b981') + '18' }}>
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">{svc.name}</p>
                          <p className="truncate text-[11px] text-gray-500">{cat?.name}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{inr(svc.starting_price)}</span>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Matched professionals */}
            {matchedPros.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Professionals ({matchedPros.length})</h3>
                <div className="space-y-2">
                  {matchedPros.map((pro) => (
                    <Card key={pro.id} onClick={() => navigate({ name: 'professional', id: pro.id })} className="flex items-center gap-3 p-3.5">
                      <img src={pro.avatar_url} alt="" className="h-11 w-11 rounded-xl bg-gray-100 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{pro.name}</p>
                        <div className="flex items-center gap-1">
                          <Stars rating={pro.rating} size={11} />
                          <span className="text-[11px] text-gray-500">{pro.rating} · {pro.completed_jobs} jobs</span>
                        </div>
                      </div>
                      <Badge tone={pro.status === 'available' ? 'success' : 'warning'}>
                        {pro.status === 'available' ? 'Available' : 'Busy'}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {matchedServices.length === 0 && matchedPros.length === 0 && (
              <EmptyState
                icon={<Icons.SearchX size={28} />}
                title={`No results for "${query}"`}
                subtitle="Try a different search term or browse categories."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
