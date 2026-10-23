import { Home, CalendarCheck, LayoutGrid, BriefcaseBusiness, ChevronDown } from 'lucide-react';
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
  // Both role apps own a bell: customers read /customer/notifications, providers
  // read /provider/notifications - same component, JWT decides the endpoint.
  const showBell = (role === 'customer' && !!customer) || (role === 'provider' && !!providerId);
  const accountName = role === 'provider' ? 'Partner workspace' : customer?.name || 'Your account';
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'L';
  const accountActive = (role === 'provider' ? ['provider-profile'] : ['profile', 'addresses', 'favourites', 'help', 'refunds']).includes(screen.name);

  return (
    <div className="sticky top-0 z-50 shrink-0 border-b border-slate-200/80 bg-white">
      <nav className="hidden h-[80px] w-full items-center gap-6 px-[25px] lg:flex">
        <div className="flex min-w-0 shrink-0 items-center gap-3.5">
          <button onClick={() => navigate(items[0].screen)} className="flex shrink-0 items-center gap-3">
            <Logo size={40} className="rounded-xl shadow-sm ring-1 ring-gray-200/80" />
            {/* Brand rule: "Seva" is always orange-500 in the LuckySeva wordmark. Never recolour it. */}
            <span className="text-[19px] font-extrabold tracking-tight">
              <span className="text-black">Lucky</span>
              <span className="text-orange-500">Seva</span>
            </span>
          </button>
          {role === 'provider' && <span className="hidden border-l border-slate-200 pl-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 xl:block">Partner</span>}
        </div>

        <div className="ml-auto flex h-full items-center gap-1">
          {items.map((tab) => {
            const Icon = tab.icon;
            const isActive = (activeRoutes[tab.label] || [tab.screen.name]).includes(screen.name);
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.screen)}
                className={`relative flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors ${isActive ? 'text-emerald-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Icon size={17} />
                {tab.label}
                {isActive && <span className="absolute inset-x-4 -bottom-[14px] h-0.5 rounded-full bg-emerald-600" />}
              </button>
            );
          })}
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3">
          {showBell && <NotificationBell />}
          <button
            onClick={() => navigate(role === 'provider' ? { name: 'provider-profile' } : { name: 'profile' })}
            aria-label={`Open ${role === 'provider' ? 'partner' : 'account'} profile`}
            className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 transition ${accountActive ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold text-white">{role === 'provider' ? <BriefcaseBusiness size={15} /> : accountInitial}</span>
            <span className="max-w-[150px] truncate text-left text-[11px] font-bold text-slate-800">{accountName}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </div>
      </nav>
    </div>
  );
};
