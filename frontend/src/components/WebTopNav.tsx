import { useState } from 'react';
import { Home, CalendarCheck, LayoutGrid, BriefcaseBusiness, ChevronDown, Search } from 'lucide-react';
import { useApp, Screen, Role } from '@/context/app-context';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { isNative } from '@/utils/native';

const customerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Home', icon: Home, screen: { name: 'home' } },
  { label: 'Services', icon: LayoutGrid, screen: { name: 'services' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'bookings' } },
];

const providerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Requests', icon: Home, screen: { name: 'provider-home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'provider-bookings' } },
  { label: 'Earnings', icon: LayoutGrid, screen: { name: 'provider-earnings' } },
];

export const WebTopNav = ({ role }: { role: Role }) => {
  const { screen, navigate, customer, providerId } = useApp();
  const [searchValue, setSearchValue] = useState(screen.name === 'search' ? screen.q || '' : '');
  if (isNative) return null;
  if (screen.name === 'auth' || screen.name === 'provider-auth') return null;
  const items = role === 'provider' ? providerItems : role === 'admin' ? [] : customerItems;
  if (!items.length) return null;
  const activeRoutes: Record<string, string[]> = role === 'provider'
    ? {
        Requests: ['provider-home', 'provider-detail'],
        Bookings: ['provider-bookings', 'invoice'],
        Earnings: ['provider-earnings'],
      }
    : {
        Home: ['home'],
        Bookings: ['bookings', 'tracking', 'booking-success', 'invoice', 'reviews'],
        Services: ['services', 'category', 'service', 'professionals', 'professional', 'booking', 'payment'],
      };
  const showBell = (role === 'customer' && !!customer) || (role === 'provider' && !!providerId);
  const accountName = role === 'provider' ? 'Partner workspace' : customer?.name || 'Your account';
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'L';
  const accountActive = (role === 'provider' ? ['provider-profile', 'help'] : ['profile', 'addresses', 'favourites', 'help', 'refunds', 'notifications']).includes(screen.name);

  return (
    <div className="sticky top-0 z-50 shrink-0 border-b border-slate-200/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <nav className="hidden h-[76px] w-full items-center px-[25px] lg:flex">
        <div className="flex min-w-0 shrink-0 items-center gap-3.5">
          <button onClick={() => navigate(items[0].screen)} className="group flex shrink-0 items-center gap-3">
            <Logo size={38} className="rounded-xl shadow-sm ring-1 ring-slate-200/80 transition group-hover:shadow-md group-hover:ring-emerald-100" />
            <span className="text-[18px] font-extrabold tracking-tight">
              <span className="text-slate-900">Lucky</span>
              <span className="text-orange-500">Seva</span>
            </span>
          </button>
          {role === 'provider' && <span className="hidden border-l border-slate-200 pl-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 xl:block">Partner</span>}
        </div>

        {role === 'customer' && (
          <div className="relative ml-8 hidden xl:block">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchValue}
              onChange={(e) => {
                const value = e.target.value;
                setSearchValue(value);
                navigate({ name: 'search', q: value });
              }}
              onFocus={() => {
                if (screen.name !== 'search') navigate({ name: 'search', q: searchValue });
              }}
              placeholder="Search services, categories, professionals..."
              aria-label="Search services, categories and professionals"
              className="h-10 w-[300px] rounded-full border border-slate-200 bg-white pl-11 pr-4 text-[13px] text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 xl:w-[340px]"
            />
          </div>
        )}

        <div className="ml-auto flex h-full items-center gap-1">
          {items.map((tab) => {
            const Icon = tab.icon;
            const isActive = (activeRoutes[tab.label] || [tab.screen.name]).includes(screen.name);
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.screen)}
                className={`group relative flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-all ${isActive ? 'text-emerald-800' : 'text-slate-500 hover:bg-slate-50/80 hover:text-slate-900'}`}
              >
                <Icon size={17} className={isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'} />
                {tab.label}
                {isActive && <span className="absolute inset-x-5 -bottom-[15px] h-[2px] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600" />}
              </button>
            );
          })}
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2.5">
          {showBell && <NotificationBell />}
          <button
            onClick={() => navigate(role === 'provider' ? { name: 'provider-profile' } : { name: 'profile' })}
            aria-label={`Open ${role === 'provider' ? 'partner' : 'account'} profile`}
            className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-all ${accountActive ? 'border-emerald-200 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-md'}`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold text-white shadow-inner">
              {role === 'provider' ? <BriefcaseBusiness size={15} /> : accountInitial}
            </span>
            <div className="flex flex-col items-start leading-none">
              <span className="max-w-[150px] truncate text-left text-[11px] font-bold text-slate-800">{accountName}</span>
              <span className="mt-0.5 text-[9px] font-medium text-slate-400">{role === 'provider' ? 'Partner' : 'Account'}</span>
            </div>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </div>
      </nav>
    </div>
  );
};
