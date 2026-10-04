import * as Icons from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/app-context';
import { useProfessionalWithFallback, useReviews } from '@/hooks';
import { ApiError, api, setApiToken } from '@/services/api';
import { fetchCurrentLocation, areaFrom } from '@/services/location';
import { TopBar } from '@/components/PhoneShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Card, Spinner, Button, Stars, EmptyState, VerifiedBadge, Avatar } from '@/components/ui';
import { inr, formatDate } from '@/utils/format';
import { kycStatus, kycDocLabel, KYC_STATUS_LABEL } from '@/utils/kyc';
import type { Category, Professional, Service } from '@/types';
import { usePayouts } from '@/hooks';

type OfferedService = Service & { offered: boolean };

const STALE_BACKEND_HINT =
  'This backend build has no services picker yet. Redeploy the backend (Render), then retry.';

/** A failed load must not be dressed up as "your trade has no services". */
const servicesErrorMessage = (e: unknown) => {
  if (e instanceof ApiError && e.status === 404) return STALE_BACKEND_HINT;
  if (e instanceof ApiError && e.status === 401) return 'Session expired — log in again.';
  return e instanceof Error ? e.message : 'Could not load your services';
};

export const ProviderProfileScreen = () => {
  const { setProviderId, navigate, providerId } = useApp();
  const { professional: pro, loading, reload } = useProfessionalWithFallback(providerId);
  const { reviews, loading: revLoading } = useReviews(pro?.id || null);
  const { reload: reloadPayouts } = usePayouts(pro?.id || null);
  const [updatingAvail, setUpdatingAvail] = useState(false);
  const [sheet, setSheet] = useState<'services' | 'pricing' | 'reviews' | 'bank' | 'settings' | null>(null);
  const [bank, setBank] = useState({ bank_account_number: '', bank_ifsc: '', upi_id: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [bankMsg, setBankMsg] = useState('');
  const [catalog, setCatalog] = useState<OfferedService[]>([]);
  const [tradeSlug, setTradeSlug] = useState('');
  const [trades, setTrades] = useState<Category[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [savingTrade, setSavingTrade] = useState('');
  const [pendingTrade, setPendingTrade] = useState('');
  const [pickingTrade, setPickingTrade] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [price, setPrice] = useState('');
  const [radius, setRadius] = useState('60');
  const [updatingLoc, setUpdatingLoc] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);
  useEffect(() => {
    if (sheet === 'bank') {
      api.provider
        .payoutAccount()
        .then((a) => setBank({ bank_account_number: a.bank_account_number || '', bank_ifsc: a.bank_ifsc || '', upi_id: a.upi_id || '' }))
        .catch(() => setBank({ bank_account_number: '', bank_ifsc: '', upi_id: '' }));
    }
  }, [sheet]);

  const loadServices = useCallback(() => {
    setLoadingServices(true);
    setServicesError('');
    api.provider
      .myServices()
      .then(({ services, category_slug }) => {
        setTradeSlug(category_slug || '');
        setCatalog(services || []);
        setPicked((services || []).filter((s) => s.offered).map((s) => s.id));
      })
      .catch((e) => setServicesError(servicesErrorMessage(e)))
      .finally(() => setLoadingServices(false));
  }, []);

  // Only on identity change: a radius/price save calls reload(), and re-running
  // here would throw away the selection the provider is still editing.
  useEffect(() => {
    if (!pro?.id) return;
    loadServices();
  }, [pro?.id, loadServices]);

  useEffect(() => {
    setPrice(String(pro?.starting_price));
    setRadius(String(pro?.service_radius_km || 60));
  }, [pro?.starting_price, pro?.service_radius_km]);

  const loadTrades = useCallback(async () => {
    setLoadingTrades(true);
    try {
      setTrades(await api.catalog.categories());
    } catch {
      setTrades([]);
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  /** Only used when the trade is unset, so a provider is never admin-gated. */
  const pickTrade = async (slug: string) => {
    setSavingTrade(slug);
    setServicesError('');
    try {
      await api.provider.setTrade(slug);
      setPendingTrade('');
      setPickingTrade(false);
      loadServices();
      reload();
    } catch (e) {
      setServicesError(servicesErrorMessage(e));
    } finally {
      setSavingTrade('');
    }
  };

  /** Changing trade drops the old trade's services, so ask before that happens. */
  const requestTrade = (slug: string) => {
    const hasSelection = picked.length > 0 || catalog.some((s) => s.offered);
    if (hasSelection) {
      setPendingTrade(slug);
      return;
    }
    pickTrade(slug);
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Profile" showBack={false} /><Spinner className="py-20" /></div>;
  if (!pro)
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        <TopBar title="My Profile" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Icons.UserPlus size={40} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-800">No provider account found</p>
          <p className="text-xs text-gray-500">Sign in or create a provider account to continue.</p>
          <Button onClick={() => navigate({ name: 'provider-auth' })}>Sign in as provider</Button>
        </div>
      </div>
    );

  const tradeLabel = (tradeSlug || '').replace(/-/g, ' ');
  const savedIds = catalog.filter((s) => s.offered).map((s) => s.id);
  const dirty = picked.length !== savedIds.length || picked.some((id) => !savedIds.includes(id));

  const toggleAvailability = async () => {
    if (!pro) return;
    setUpdatingAvail(true);
    await api.provider.updateAvailability({ status: pro.status === 'available' ? 'busy' : 'available' }).catch(() => {});
    setUpdatingAvail(false);
    reload();
  };

  const savePricing = async () => {
    await api.provider.updateMe({ starting_price: Number(price) || 0 }).catch(() => {});
    setSheet(null);
    reload();
  };

  const toggleService = (id: string) => {
    setServicesError('');
    setPicked((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const saveServices = async () => {
    if (!picked.length) {
      setServicesError('Keep at least one service — customers can only book what you offer.');
      return;
    }
    setSavingServices(true);
    setServicesError('');
    try {
      await api.provider.setServices(picked);
      loadServices();
      reload();
      setSheet(null);
    } catch (e) {
      setServicesError(servicesErrorMessage(e));
    } finally {
      setSavingServices(false);
    }
  };

  const updateLocation = async () => {
    setUpdatingLoc(true);
    try {
      const loc = await fetchCurrentLocation();
      await api.provider
        .updateAvailability({
          latitude: loc.latitude,
          longitude: loc.longitude,
        })
        .catch(() => {});
      await api.provider
        .updateMe({
          latitude: loc.latitude,
          longitude: loc.longitude,
          service_area: areaFrom(loc.details) || pro.service_area,
        })
        .catch(() => {});
    } catch {
      /* location remains unchanged on failure */
    } finally {
      setUpdatingLoc(false);
      reload();
    }
  };

  const saveRadius = async () => {
    setSavingRadius(true);
    await api.provider.updateMe({ service_radius_km: Number(radius) || 60 }).catch(() => {});
    setSavingRadius(false);
    reload();
  };

  const applyRadius = async (km: number) => {
    setRadius(String(km));
    setSavingRadius(true);
    await api.provider.updateMe({ service_radius_km: km }).catch(() => {});
    setSavingRadius(false);
    reload();
  };
  const saveBank = async () => {
    setSavingBank(true);
    setBankMsg('');
    try {
      await api.provider.savePayoutAccount(bank);
      setBankMsg('Saved');
      setSheet(null);
      reloadPayouts();
    } catch (e) {
      setBankMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Profile" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Profile header */}
        <Card className="flex items-center gap-4 p-4">
          <Avatar src={pro.avatar_url} name={pro.name} className="h-16 w-16 rounded-2xl text-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-bold text-gray-900">{pro.name}</p>
              {kycStatus(pro) === 'approved' && <VerifiedBadge />}
            </div>
            <p className="text-xs text-gray-500">{pro.skills.join(', ')}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Stars rating={pro.rating} size={12} />
              <span className="text-xs font-semibold text-gray-700">{pro.rating}</span>
              <span className="ml-2 text-xs text-gray-400">{pro.phone || 'No phone linked'}</span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox icon={<Icons.Briefcase size={16} />} label="Experience" value={`${pro.experience_years} yrs`} />
          <StatBox icon={<Icons.CheckCircle2 size={16} />} label="Completed" value={`${pro.completed_jobs}`} />
          <StatBox icon={<Icons.Star size={16} />} label="Reviews" value={`${pro.reviews_count}`} />
        </div>

        {/* Availability toggle */}
        <Card className="mt-3 flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Availability</p>
            <p className="text-[11px] text-gray-500">Accept new booking requests</p>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={updatingAvail}
            className={`relative h-7 w-12 rounded-full transition-colors ${pro.status === 'available' ? 'bg-emerald-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${pro.status === 'available' ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </Card>

        {/* KYC / Verification */}
        <KycCard pro={pro} onComplete={reload} />

        {/* Service area = my location + radius */}
        <Card className="mt-3 p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icons.MapPin size={18} />
              {pro.latitude != null && pro.longitude != null && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">My Location</p>
              <p className="truncate text-[11px] text-gray-500">
                {pro.service_area || (pro.latitude != null && pro.longitude != null ? `${pro.latitude.toFixed(4)}, ${pro.longitude.toFixed(4)}` : 'No location set')}
              </p>
            </div>
            <Button variant="outline" onClick={updateLocation} disabled={updatingLoc} className="shrink-0 py-1.5 text-[11px]">
              <Icons.LocateFixed size={12} />
              {updatingLoc ? 'Detecting...' : 'Update'}
            </Button>
          </div>

          <div className="mt-4 border-t border-gray-50 pt-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Service Radius</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">{radius} km</span>
            </div>
            <p className="mb-3 text-[11px] text-gray-500">
              Receive booking requests from customers within this radius of your location.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[10, 25, 50, 75, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => applyRadius(n)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    String(n) === radius
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
                  }`}
                >
                  {n} km
                </button>
              ))}
              <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1.5">
                <input
                  value={radius}
                  onChange={(e) => setRadius(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="?"
                  aria-label="Custom service radius in km"
                  className="w-9 text-center text-xs font-semibold text-gray-700 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400">km</span>
                <button
                  onClick={saveRadius}
                  disabled={savingRadius || String(pro.service_radius_km || 60) === radius}
                  className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {savingRadius ? '...' : 'Set'}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Menu */}
        <div className="mt-4 space-y-2">
          <MenuRow
            icon={<Icons.Wrench size={18} />}
            label="Services Offered"
            value={
              loadingServices
                ? 'loading...'
                : servicesError
                  ? 'unavailable'
                  : `${picked.length} of ${catalog.length}`
            }
            onClick={() => {
              setServicesError('');
              setPickingTrade(false);
              setSheet('services');
              if (!catalog.length) loadTrades();
            }}
          />
          <MenuRow icon={<Icons.Tags size={18} />} label="Pricing" value={inr(pro.starting_price) + '+'} onClick={() => { setPrice(String(pro.starting_price)); setSheet('pricing'); }} />
          <MenuRow icon={<Icons.Star size={18} />} label="Ratings & Reviews" value={`${pro.reviews_count}`} onClick={() => setSheet('reviews')} />
          <MenuRow icon={<Icons.Banknote size={18} />} label="Bank Details" value="Withdraw" onClick={() => setSheet('bank')} />
          <MenuRow icon={<Icons.Settings size={18} />} label="Settings" value="" onClick={() => setSheet('settings')} />
          <MenuRow icon={<Icons.HeadphonesIcon size={18} />} label="Help & Support" value="" onClick={() => navigate({ name: 'help' })} />
        </div>

        {/* Recent reviews */}
        {reviews.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Recent Reviews</h3>
            <div className="space-y-2">
              {reviews.slice(0, 2).map((rev) => (
                <Card key={rev.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900">{rev.customer_name}</p>
                    <div className="flex items-center gap-1">
                      <Icons.Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-semibold">{rev.rating}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">{rev.comment}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => { setApiToken(null); setProviderId(null); navigate({ name: 'provider-auth' }); }}
          className="mt-4 w-full text-red-500"
        >
          <Icons.LogOut size={16} /> Logout
        </Button>
        <p className="mt-3 text-center text-[10px] text-gray-400">LuckySeva Provider v1.0.0</p>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-40 flex flex-col bg-gray-50">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-3">
            <button onClick={() => (pickingTrade && catalog.length ? setPickingTrade(false) : setSheet(null))} className="text-gray-400">
              <Icons.X size={22} />
            </button>
            <p className="flex-1 text-base font-bold text-gray-900">
              {sheet === 'services'
                ? pickingTrade && catalog.length
                  ? 'Change Trade'
                  : 'Services Offered'
                : sheet === 'pricing' ? 'Pricing' : sheet === 'reviews' ? 'Ratings & Reviews' : sheet === 'bank' ? 'Bank Details' : 'Settings'}
            </p>
            {sheet === 'services' && tradeLabel && !pickingTrade && (
              <button
                onClick={() => { setServicesError(''); setPickingTrade(true); loadTrades(); }}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700"
              >
                {tradeLabel}
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar space-y-3 p-4">
            {sheet === 'services' && (
              loadingServices ? (
                <Spinner className="py-10" />
              ) : servicesError && catalog.length === 0 ? (
                <Card className="p-4 text-center">
                  <Icons.WifiOff size={26} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-sm font-semibold text-gray-900">Could not load your services</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{servicesError}</p>
                  <Button variant="outline" onClick={loadServices} className="mt-3 w-full">Retry</Button>
                </Card>
              ) : pickingTrade || catalog.length === 0 ? (
                /* No trade set (or one the catalogue has nothing for): let the
                   provider pick their own trade here instead of waiting on an
                   admin edit. Once set, only that trade's sub-services appear. */
                loadingTrades ? (
                  <Spinner className="py-10" />
                ) : trades.length === 0 ? (
                  <Card className="p-4 text-center">
                    <Icons.Wrench size={26} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-sm font-semibold text-gray-900">Could not load the trades</p>
                    <p className="mt-1 text-[11px] text-gray-500">Check your connection and try again.</p>
                    <Button variant="outline" onClick={loadTrades} className="mt-3 w-full">Retry</Button>
                  </Card>
                ) : (
                  <>
                    <Card className="p-3.5">
                      <p className="text-sm font-bold text-gray-900">
                        {catalog.length ? 'Change your trade' : 'Which trade do you work in?'}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                        Pick your trade, then tick only the {tradeSlug ? tradeLabel : 'trade'} sub-services you actually
                        offer. You can change it later.
                      </p>
                    </Card>
                    {servicesError && <p className="text-[11px] font-medium text-red-500">{servicesError}</p>}
                    {trades.map((t) => (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => requestTrade(t.slug)}
                        disabled={!!savingTrade}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-60 ${
                          t.slug === tradeSlug ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-white'
                        }`}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: t.color || '#0ea5e9' }}
                        >
                          {t.name.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{t.name}</p>
                          <p className="truncate text-[11px] text-gray-400">{t.description}</p>
                        </div>
                        {savingTrade === t.slug ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Icons.ChevronRight size={16} className="shrink-0 text-gray-300" />
                        )}
                      </button>
                    ))}
                  </>
                )
              ) : (
                <>
                  <Card className="p-3.5">
                    <p className="text-[11px] leading-relaxed text-gray-500">
                      These are only the {tradeLabel ? tradeLabel.toLowerCase() : 'trade'} services — the trade you
                      signed up with. Turn off the ones you don't do: those requests stop coming to you and customers
                      stop seeing them. Switch trade with the badge above.
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                      <span className="text-xs font-semibold text-gray-900">
                        {picked.length} of {catalog.length} selected
                      </span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setServicesError(''); setPicked(catalog.map((s) => s.id)); }} className="text-[11px] font-semibold text-emerald-600">
                          Select all
                        </button>
                        <button onClick={() => { setServicesError(''); setPicked([]); }} className="text-[11px] font-semibold text-gray-400">
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${catalog.length ? (picked.length / catalog.length) * 100 : 0}%` }}
                      />
                    </div>
                  </Card>

                  {catalog.map((svc) => {
                    const on = picked.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                          on ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 bg-white'
                          }`}
                        >
                          {on && <Icons.Check size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{svc.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {svc.estimated_duration}
                            {!on && <span className="ml-1 font-medium text-gray-400">· hidden</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-gray-700">{inr(svc.starting_price)}</span>
                      </button>
                    );
                  })}

                  {servicesError && <p className="text-[11px] font-medium text-red-500">{servicesError}</p>}

                  <Button onClick={saveServices} disabled={savingServices || !dirty} className="w-full">
                    {savingServices
                      ? 'Saving...'
                      : !picked.length
                        ? 'Save selection'
                        : picked.length === catalog.length
                          ? `Save all ${catalog.length} services`
                          : `Save ${picked.length} of ${catalog.length} services`}
                  </Button>
                  <p className="text-center text-[10px] text-gray-400">
                    Your profile price updates to the cheapest service you keep.
                  </p>
                </>
              )
            )}

            {sheet === 'pricing' && (
              <>
                <Card className="p-4">
                  <p className="mb-1 text-xs font-semibold text-gray-700">Starting price (INR)</p>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </Card>
                <Button onClick={savePricing} className="w-full">Save Pricing</Button>
              </>
            )}
            {sheet === 'bank' && (
              <>
                <Card className="p-4 space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-700">UPI ID</p>
                    <input
                      value={bank.upi_id}
                      onChange={(e) => setBank({ ...bank, upi_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-700">Account number</p>
                    <input
                      value={bank.bank_account_number}
                      onChange={(e) => setBank({ ...bank, bank_account_number: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-700">IFSC</p>
                    <input
                      value={bank.bank_ifsc}
                      onChange={(e) => setBank({ ...bank, bank_ifsc: e.target.value.toUpperCase() })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </Card>
                {bankMsg && <p className="text-[11px] text-gray-500">{bankMsg}</p>}
                <Button onClick={saveBank} disabled={savingBank} className="w-full">
                  {savingBank ? 'Saving...' : 'Save Bank Details'}
                </Button>
              </>
            )}

            {sheet === 'reviews' && (
              revLoading ? <Spinner className="py-10" /> :
              reviews.length ? reviews.map((rev) => (
                <Card key={rev.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900">{rev.customer_name}</p>
                    <div className="flex items-center gap-1">
                      <Icons.Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-semibold">{rev.rating}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">{rev.comment}</p>
                </Card>
              )) : <EmptyState icon={<Icons.Star size={26} />} title="No reviews yet" />)
            }

            {sheet === 'bank' && (
              <>
                <Card className="p-4">
                  <p className="mb-1 text-xs font-semibold text-gray-700">Account holder name</p>
                  <input defaultValue={localStorage.getItem('luckyseva.acName') || pro.name} onChange={(e) => localStorage.setItem('luckyseva.acName', e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                  <p className="mb-1 mt-3 text-xs font-semibold text-gray-700">Account number</p>
                  <input defaultValue={localStorage.getItem('luckyseva.acNo') || ''} onChange={(e) => localStorage.setItem('luckyseva.acNo', e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                  <p className="mb-1 mt-3 text-xs font-semibold text-gray-700">IFSC</p>
                  <input defaultValue={localStorage.getItem('luckyseva.ifsc') || ''} onChange={(e) => localStorage.setItem('luckyseva.ifsc', e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                </Card>
                <p className="text-center text-[11px] text-gray-400">Details are stored locally and used for withdrawals.</p>
              </>
            )}

            {sheet === 'settings' && (
              <SettingRow storageKey="luckyseva.provider.push" label="Push notifications" />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingTrade}
        busy={!!savingTrade}
        title="Change your trade?"
        message={`Switching to ${trades.find((t) => t.slug === pendingTrade)?.name || 'this trade'} will remove the ${tradeLabel || 'current'} services you selected. You can tick the new ones after that.`}
        confirmLabel="Change trade"
        cancelLabel="Keep trade"
        onConfirm={() => pendingTrade && pickTrade(pendingTrade)}
        onCancel={() => setPendingTrade('')}
      />
    </div>
  );
};

const KycCard = ({ pro, onComplete }: { pro: Professional; onComplete: () => void }) => {
  const status = kycStatus(pro);
  const statusTone =
    status === 'approved' ? { text: 'text-emerald-600', bg: 'bg-emerald-50' }
    : status === 'pending' ? { text: 'text-amber-600', bg: 'bg-amber-50' }
    : status === 'rejected' ? { text: 'text-red-500', bg: 'bg-red-50' }
    : { text: 'text-gray-500', bg: 'bg-gray-100' };
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState('aadhaar');
  const [docNumber, setDocNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.provider.submitKyc({ doc_type: docType, doc_number: docNumber });
      setOpen(false);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit verification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${statusTone.bg} ${statusTone.text}`}>
            {status === 'approved' ? <Icons.BadgeCheck size={20} /> : <Icons.ShieldCheck size={20} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Verification (KYC)</p>
            <p className="text-[11px] text-gray-500">Build trust and get the Verified badge</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone.bg} ${statusTone.text}`}>
          {KYC_STATUS_LABEL[status]}
        </span>
      </div>

      {status === 'approved' && (
        <div className="mt-3 rounded-xl bg-emerald-50/60 px-3 py-2.5 text-[11px] text-emerald-700">
          You're a verified provider. Customers see the Verified badge on your profile.
          {pro.kyc_doc_number ? ` Document on file: ${kycDocLabel(pro)} (${pro.kyc_doc_number}).` : ''}
        </div>
      )}

      {status === 'pending' && (
        <div className="mt-3 rounded-xl bg-amber-50/60 px-3 py-2.5 text-[11px] text-amber-700">
          Verification under review. Submitted {pro.kyc_submitted_at ? formatDate(pro.kyc_submitted_at) : ''} — {kycDocLabel(pro)}{pro.kyc_doc_number ? ` (${pro.kyc_doc_number})` : ''}.
        </div>
      )}

      {status === 'rejected' && (
        <div className="mt-3 rounded-xl bg-red-50/60 px-3 py-2.5 text-[11px] text-red-600">
          {pro.kyc_review_note ? `Rejected: ${pro.kyc_review_note}` : 'Verification was rejected.'}
        </div>
      )}

      {(status === 'not_submitted' || status === 'rejected' || open) && (
        <div className="mt-3 space-y-3 border-t border-gray-50 pt-3">
          {!open ? (
            <Button variant={status === 'rejected' ? 'secondary' : 'primary'} onClick={() => { setDocNumber(''); setError(''); setOpen(true); }} className="w-full py-2 text-xs">
              {status === 'rejected' ? 'Re-submit documents' : 'Submit documents for verification'}
            </Button>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Document type</span>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="voter">Voter ID</option>
                  <option value="driving">Driving Licence</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Document number</span>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value.toUpperCase().slice(0, 20))}
                  placeholder="e.g. XXXX XXXX XXXX"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="flex-1 py-2 text-xs">
                  Cancel
                </Button>
                <Button onClick={submit} disabled={saving || docNumber.trim().length < 6} className="flex-1 py-2 text-xs">
                  {saving ? 'Submitting...' : 'Submit for Review'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

const StatBox = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="flex flex-col items-center p-3 text-center">
    <span className="text-emerald-500">{icon}</span>
    <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    <p className="text-[10px] text-gray-400">{label}</p>
  </Card>
);

const MenuRow = ({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:shadow-sm">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600">{icon}</div>
    <span className="flex-1 text-sm font-medium text-gray-900">{label}</span>
    {value && <span className="text-xs text-gray-400">{value}</span>}
    <Icons.ChevronRight size={16} className="text-gray-300" />
  </button>
);

const SettingRow = ({ label, storageKey }: { label: string; storageKey: string }) => {
  const [on, setOn] = useState<boolean>(() => (localStorage.getItem(storageKey) ?? 'on') === 'on');
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <button
        onClick={() => {
          const next = !on;
          localStorage.setItem(storageKey, next ? 'on' : 'off');
          setOn(next);
        }}
        className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
};