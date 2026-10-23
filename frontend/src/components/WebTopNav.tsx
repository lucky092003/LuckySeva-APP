import { Home, CalendarCheck, LayoutGrid, User } from 'lucide-react';
import { useApp, Screen, Role } from '@/context/app-context';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { isNative } from '@/utils/native';

const customerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Home', icon: Home, screen: { name: 'home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'bookings' } },
  { label: 'Services', icon: LayoutGrid, screen: { name: 'services' } },
  { label: 'Profile', icon: User, screen: { name: 'profile' } },
];

const providerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Requests', icon: Home, screen: { name: 'provider-home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'provider-bookings' } },
  { label: 'Earnings', icon: LayoutGrid, screen: { name: 'provider-earnings' } },
  { label: 'Profile', icon: User, screen: { name: 'provider-profile' } },
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
        Profile: ['provider-profile'],
      }
    : {
        Home: ['home'],
        Bookings: ['bookings', 'tracking', 'booking-success', 'invoice', 'reviews'],
        Services: ['services', 'category', 'service', 'professionals', 'professional', 'booking', 'payment'],
        Profile: ['profile', 'addresses', 'favourites', 'help', 'refunds'],
      };
  // Both role apps own a bell: customers read /customer/notifications, providers
  // read /provider/notifications - same component, JWT decides the endpoint.
  const showBell = (role === 'customer' && !!customer) || (role === 'provider' && !!providerId);

  return (
    <div className="sticky top-0 z-50 shrink-0 border-b border-slate-200/80 bg-white">
      <nav className="mx-auto hidden h-[76px] w-full max-w-7xl items-center justify-between gap-8 px-8 lg:flex xl:px-10">
        <button onClick={() => navigate(items[0].screen)} className="flex shrink-0 items-center gap-3">
          <Logo size={40} className="rounded-xl shadow-sm ring-1 ring-gray-200/80" />
          {/* Brand rule: "Seva" is always orange-500 in the LuckySeva wordmark. Never recolour it. */}
          <span className="text-[19px] font-extrabold tracking-tight">
            <span className="text-black">Lucky</span>
            <span className="text-orange-500">Seva</span>
          </span>
        </button>
        <div className="flex h-full items-center gap-1">
          {items.map((tab) => {
            const Icon = tab.icon;
            const isActive = (activeRoutes[tab.label] || [tab.screen.name]).includes(screen.name);
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.screen)}
                className={`relative flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Icon size={17} />
                {tab.label}
                {isActive && <span className="absolute inset-x-4 -bottom-[14px] h-0.5 rounded-full bg-emerald-600" />}
              </button>
            );
          })}
          {showBell && <div className="ml-2 border-l border-slate-200 pl-3"><NotificationBell /></div>}
        </div>
      </nav>
    </div>
  );
};
