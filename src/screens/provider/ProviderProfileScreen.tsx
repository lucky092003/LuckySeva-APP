import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useProfessionalWithFallback, useReviews } from '@/lib/hooks';
import { api, setApiToken } from '@/lib/api';
import { fetchCurrentLocation, areaFrom } from '@/lib/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Stars, EmptyState } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Service } from '@/lib/types';

export const ProviderProfileScreen = () => {
  const { setProviderId, navigate, providerId } = useApp();
  const { professional: pro, loading, reload } = useProfessionalWithFallback(providerId);
  const { reviews, loading: revLoading } = useReviews(pro?.id || null);
  const [updatingAvail, setUpdatingAvail] = useState(false);
  const [sheet, setSheet] = useState<'services' | 'pricing' | 'reviews' | 'bank' | 'settings' | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [price, setPrice] = useState('');
  const [radius, setRadius] = useState('60');
  const [updatingLoc, setUpdatingLoc] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);

  useEffect(() => {
    if (!pro?.id) return;
    api.provider
      .me()
      .then(({ services }) => {
        setServices((services || []).map((r) => r.service).filter(Boolean));
      })
      .catch(() => {});
    setPrice(String(pro.starting_price));
    setRadius(String(pro.service_radius_km || 60));
  }, [pro?.id, pro?.starting_price, pro?.service_radius_km]);

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

  const toggleAvailability = async () => {
    if (!pro) return;
    setUpdatingAvail(true);
    await api.provider.updateMe({ status: pro.status === 'available' ? 'busy' : 'available' }).catch(() => {});
    setUpdatingAvail(false);
    reload();
  };

  const savePricing = async () => {
    await api.provider.updateMe({ starting_price: Number(price) || 0 }).catch(() => {});
    setSheet(null);
    reload();
  };

  const updateLocation = async () => {
    setUpdatingLoc(true);
    try {
      const loc = await fetchCurrentLocation();
      await api.provider
        .updateMe({
          latitude: loc.latitude,
          longitude: loc.longitude,
          service_area: areaFrom(loc.details) || pro.service_area,
        })
        .catch(() => {});
    } catch {
      /* location remains unchanged on failure */
    }
    setUpdatingLoc(false);
    reload();
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Profile" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Profile header */}
        <Card className="flex items-center gap-4 p-4">
          <img src={pro.avatar_url} alt={pro.name} className="h-16 w-16 rounded-2xl bg-gray-100 object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-bold text-gray-900">{pro.name}</p>
              <Icons.BadgeCheck size={16} className="text-emerald-500" />
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
          <MenuRow icon={<Icons.Wrench size={18} />} label="Services Offered" value={`${services.length}`} onClick={() => setSheet('services')} />
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
            <button onClick={() => setSheet(null)} className="text-gray-400"><Icons.X size={22} /></button>
            <p className="flex-1 text-base font-bold text-gray-900">
              {sheet === 'services' ? 'Services Offered' : sheet === 'pricing' ? 'Pricing' : sheet === 'reviews' ? 'Ratings & Reviews' : sheet === 'bank' ? 'Bank Details' : 'Settings'}
            </p>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar space-y-3 p-4">
            {sheet === 'services' && (
              services.length ? (
                services.map((svc) => (
                  <Card key={svc.id} className="flex items-center justify-between p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{svc.name}</p>
                      <p className="text-[11px] text-gray-400">{svc.estimated_duration}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{inr(svc.starting_price)}</span>
                  </Card>
                ))
              ) : (
                <EmptyState icon={<Icons.Wrench size={26} />} title="No services linked" subtitle="Link services to start receiving bookings." />
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
    </div>
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