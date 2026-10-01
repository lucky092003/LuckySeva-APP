import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useProfessionalsByCategory, useCustomerCoords } from '@/hooks';
import { api } from '@/services/api';
import { haversineKm } from '@/services/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Stars, Badge, VerifiedBadge, SearchBar, Avatar } from '@/components/ui';
import { inr } from '@/utils/format';
import { isVerified } from '@/utils/kyc';
import type { Professional, Category } from '@/types';

type SortKey = 'rating' | 'price' | 'distance';

const MAX_PRICE = 10000;
const DEFAULT_MAX_DIST = 30;
const MAX_DIST_RANGE = 50;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Top rated' },
  { key: 'price', label: 'Lowest price' },
  { key: 'distance', label: 'Nearest' },
];

export const ProfessionalListScreen = ({ slug }: { slug: string }) => {
  const { navigate } = useApp();
  const [category, setCategory] = useState<Category | null>(null);
  const { professionals, loading } = useProfessionalsByCategory(slug);
  const coords = useCustomerCoords();

  const [sort, setSort] = useState<SortKey>('rating');
  const [sortTouched, setSortTouched] = useState(false);
  const [availOnly, setAvailOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [minExp, setMinExp] = useState(0);
  const [maxDist, setMaxDist] = useState(DEFAULT_MAX_DIST);

  useEffect(() => {
    let active = true;
    api.catalog
      .category(slug)
      .then((res) => {
        if (active) setCategory(res.category);
      })
      .catch(() => {
        if (active) setCategory(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (coords && !sortTouched) setSort('distance');
  }, [coords, sortTouched]);

  const withDistance = useMemo(() => {
    if (!coords) return professionals;
    return professionals.map((p) => {
      if (p.latitude == null || p.longitude == null) return p;
      const km = Math.round(haversineKm(coords.latitude, coords.longitude, p.latitude, p.longitude) * 10) / 10;
      return { ...p, distance_km: km };
    });
  }, [professionals, coords]);

  const availableCount = useMemo(
    () => withDistance.filter((p) => p.status === 'available').length,
    [withDistance]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = [...withDistance];

    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (availOnly) list = list.filter((p) => p.status === 'available');
    if (minRating > 0) list = list.filter((p) => p.rating >= minRating);
    if (minExp > 0) list = list.filter((p) => p.experience_years >= minExp);
    list = list.filter((p) => p.starting_price <= maxPrice);
    if (coords) list = list.filter((p) => p.distance_km <= maxDist);
    list.sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'price') return a.starting_price - b.starting_price;
      return a.distance_km - b.distance_km;
    });
    return list;
  }, [withDistance, sort, availOnly, minRating, minExp, maxPrice, maxDist, coords, query]);

  const hasFilters = availOnly || minRating > 0 || maxPrice < MAX_PRICE || minExp > 0 || maxDist < DEFAULT_MAX_DIST;
  const hasQuery = query.trim().length > 0;

  const resetAll = () => {
    setAvailOnly(false);
    setMinRating(0);
    setMaxPrice(MAX_PRICE);
    setMinExp(0);
    setMaxDist(DEFAULT_MAX_DIST);
    setQuery('');
  };

  const pickSort = (k: SortKey) => {
    setSortTouched(true);
    setSort(k);
  };

  const color = category?.color || '#10b981';
  const activeFilterChips = [
    availOnly && { label: 'Available now', clear: () => setAvailOnly(false) },
    minRating > 0 && { label: `${minRating.toFixed(1)}+ rating`, clear: () => setMinRating(0) },
    maxPrice < MAX_PRICE && { label: `Under ${inr(maxPrice)}`, clear: () => setMaxPrice(MAX_PRICE) },
    minExp > 0 && { label: `${minExp}+ yrs exp`, clear: () => setMinExp(0) },
    maxDist < DEFAULT_MAX_DIST && coords && { label: `Within ${maxDist} km`, clear: () => setMaxDist(DEFAULT_MAX_DIST) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Available Professionals"
        right={
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              showFilters ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icons.SlidersHorizontal size={18} />
          </button>
        }
      />

      {/* Search */}
      <div className="shrink-0 border-b border-gray-100 bg-white px-5 pb-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={`Search ${category?.name || 'professionals'}`}
        />
      </div>

      {/* Sort chips + availability toggle */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-100 bg-white px-5 py-2.5 no-scrollbar">
        {SORTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => pickSort(key)}
            aria-pressed={sort === key}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              sort === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setAvailOnly(!availOnly)}
          aria-pressed={availOnly}
          className={`ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            availOnly ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Available only{!availOnly && availableCount > 0 ? ` (${availableCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="shrink-0 space-y-3 border-b border-gray-100 bg-white px-5 py-3">
          <FilterRow label={`Min rating · ${minRating.toFixed(1)}+`}>
            <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          <FilterRow label={`Max price · ${inr(maxPrice)}`}>
            <input type="range" min={0} max={MAX_PRICE} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          <FilterRow label={`Min experience · ${minExp}+ yrs`}>
            <input type="range" min={0} max={15} step={1} value={minExp} onChange={(e) => setMinExp(Number(e.target.value))} className="w-full accent-emerald-500" />
          </FilterRow>
          {coords && (
            <FilterRow label={`Within · ${maxDist} km`}>
              <input type="range" min={1} max={MAX_DIST_RANGE} step={1} value={maxDist} onChange={(e) => setMaxDist(Number(e.target.value))} className="w-full accent-emerald-500" />
            </FilterRow>
          )}
        </div>
      )}

      {/* Result count + active filter chips */}
      <div className="flex shrink-0 flex-col gap-2 bg-white px-5 pb-3 pt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {loading
              ? 'Loading professionals…'
              : `${filtered.length} professional${filtered.length === 1 ? '' : 's'}`}
            {category ? ` in ${category.name}` : ''}
          </p>
          {(hasFilters || hasQuery) && (
            <button onClick={resetAll} className="text-xs font-semibold text-emerald-600">
              Reset all
            </button>
          )}
        </div>
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.label}
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
              >
                {chip.label}
                <Icons.X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {loading ? (
          <Spinner className="py-16" />
        ) : professionals.length === 0 ? (
          <EmptyState
            icon={<Icons.WifiOff size={28} />}
            title="Couldn't load professionals"
            subtitle="Check your connection and try again"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Icons.UserSearch size={28} />}
            title="No professionals match"
            subtitle="Try widening your filters or searching a different name."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {filtered.map((pro) => (
              <ProfessionalCard
                key={pro.id}
                pro={pro}
                color={color}
                onClick={() => navigate({ name: 'professional', id: pro.id })}
              />
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
        <Avatar src={pro.avatar_url} name={pro.name} className="h-16 w-16 rounded-2xl text-lg" />
        <span
          className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
            pro.status === 'available' ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-gray-900">{pro.name}</p>
          {isVerified(pro) && <VerifiedBadge />}
          <Badge tone={pro.status === 'available' ? 'success' : 'warning'} className="ml-auto shrink-0">
            {pro.status === 'available' ? 'Available' : 'Busy'}
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <Stars rating={pro.rating} />
          <span className="text-[11px] font-semibold text-gray-700">{pro.rating}</span>
          <span className="text-[11px] text-gray-400">({pro.reviews_count})</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-gray-500">{pro.skills.join(', ')}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Icons.Briefcase size={11} />
            {pro.experience_years} yrs
          </span>
          <span className="flex items-center gap-1">
            <Icons.MapPin size={11} />
            {pro.distance_km} km
          </span>
          <span className="flex items-center gap-1">
            <Icons.CheckCircle2 size={11} />
            {pro.completed_jobs} jobs
          </span>
        </div>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
      <div>
        <span className="text-[10px] text-gray-400">Starts at </span>
        <span className="text-sm font-bold" style={{ color }}>
          {inr(pro.starting_price)}
        </span>
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