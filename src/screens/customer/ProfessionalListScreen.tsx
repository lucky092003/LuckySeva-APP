import { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useProfessionalsByCategory } from '@/lib/hooks';
import { api } from '@/lib/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Stars, Badge } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Professional, Category } from '@/lib/types';
import { useEffect } from 'react';

type SortKey = 'rating' | 'price' | 'distance';

export const ProfessionalListScreen = ({ slug }: { slug: string }) => {
  const { navigate } = useApp();
  const [category, setCategory] = useState<Category | null>(null);
  useEffect(() => {
    api.catalog.category(slug).then((res) => setCategory(res.category)).catch(() => setCategory(null));
  }, [slug]);
  const { professionals, loading } = useProfessionalsByCategory(slug);

  const [sort, setSort] = useState<SortKey>('rating');
  const [availOnly, setAvailOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [minExp, setMinExp] = useState(0);
  const [maxDist, setMaxDist] = useState(25);
  const hasFilters = minRating > 0 || maxPrice < 10000 || minExp > 0 || maxDist < 25;

  const filtered = useMemo(() => {
    let list = [...professionals];
    if (availOnly) list = list.filter((p) => p.status === 'available');
    if (minRating > 0) list = list.filter((p) => p.rating >= minRating);
    if (minExp > 0) list = list.filter((p) => p.experience_years >= minExp);
    list = list.filter((p) => p.starting_price <= maxPrice);
    list = list.filter((p) => p.distance_km <= maxDist);
    list.sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'price') return a.starting_price - b.starting_price;
      return a.distance_km - b.distance_km;
    });
    return list;
  }, [professionals, sort, availOnly, minRating, minExp, maxPrice, maxDist]);

  const resetFilters = () => {
    setMinRating(0);
    setMaxPrice(10000);
    setMinExp(0);
    setMaxDist(25);
  };

  const color = category?.color || '#10b981';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Professionals" right={
        <button onClick={() => setShowFilters(!showFilters)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100">
          <Icons.SlidersHorizontal size={18} />
        </button>
      } />

      {/* Sort chips */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 py-2.5">
        {(['rating', 'price', 'distance'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all ${sort === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {k === 'distance' ? 'Nearest' : k === 'price' ? 'Lowest price' : 'Top rated'}
          </button>
        ))}
        <button
          onClick={() => setAvailOnly(!availOnly)}
          className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${availOnly ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Available only
        </button>
      </div>

      {showFilters && (
        <div className="shrink-0 space-y-3 border-b border-gray-100 bg-white px-4 py-3">
          <FilterRow label={`Min rating · ${minRating.toFixed(1)}+`}>
            <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          <FilterRow label={`Max price · ${inr(maxPrice)}`}>
            <input type="range" min={0} max={10000} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          <FilterRow label={`Min experience · ${minExp}+ yrs`}>
            <input type="range" min={0} max={15} step={1} value={minExp} onChange={(e) => setMinExp(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          <FilterRow label={`Within · ${maxDist} km`}>
            <input type="range" min={1} max={25} step={1} value={maxDist} onChange={(e) => setMaxDist(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs font-semibold text-emerald-600">
              Reset all filters
            </button>
          )}
          <p className="text-right text-[11px] text-gray-400">{filtered.length} professional{filtered.length === 1 ? '' : 's'} match</p>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {loading ? (
          <Spinner className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Icons.UserSearch size={28} />} title="No professionals found" subtitle="Try changing the filters." />
        ) : (
          <div className="space-y-3">
            {filtered.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} color={color} onClick={() => navigate({ name: 'professional', id: pro.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ProfessionalCard = ({ pro, color, onClick }: { pro: Professional; color: string; onClick: () => void }) => (
  <Card onClick={onClick} className="p-4">
    <div className="flex items-start gap-3">
      <div className="relative">
        <img src={pro.avatar_url} alt={pro.name} className="h-16 w-16 rounded-2xl bg-gray-100 object-cover" />
        <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${pro.status === 'available' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-bold text-gray-900">{pro.name}</p>
          <Badge tone={pro.status === 'available' ? 'success' : 'warning'}>
            {pro.status === 'available' ? 'Available' : 'Busy'}
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <Stars rating={pro.rating} />
          <span className="text-[11px] font-semibold text-gray-700">{pro.rating}</span>
          <span className="text-[11px] text-gray-400">({pro.reviews_count})</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-gray-500">{pro.skills.join(', ')}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Icons.Briefcase size={11} />{pro.experience_years} yrs</span>
          <span className="flex items-center gap-1"><Icons.MapPin size={11} />{pro.distance_km} km</span>
          <span className="flex items-center gap-1"><Icons.CheckCircle2 size={11} />{pro.completed_jobs} jobs</span>
        </div>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
      <div>
        <span className="text-[10px] text-gray-400">Starts at </span>
        <span className="text-sm font-bold" style={{ color }}>{inr(pro.starting_price)}</span>
      </div>
      <span className="text-xs font-semibold text-emerald-600">View Profile →</span>
    </div>
  </Card>
);

const FilterRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-1 flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </div>
    {children}
  </div>
);
