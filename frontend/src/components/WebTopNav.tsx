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
  const { screen, navigate, customer } = useApp();
  if (isNative) return null;
  if (screen.name === 'auth' || screen.name === 'provider-auth') return null;
  const items = role === 'provider' ? providerItems : role === 'admin' ? [] : customerItems;
  if (!items.length) return null;
  const activeName = screen.name;
  const showBell = role === 'customer' && !!customer;

  return (
    <div className="sticky top-0 z-50">
      <nav className="hidden shrink-0 items-center justify-between gap-4 bg-emerald-600 px-5 py-2 md:flex">
        <button onClick={() => navigate(items[0].screen)} className="flex items-center gap-2">
          <Logo size={36} />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-white">Lucky</span>
            <span className="text-emerald-200">Seva</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          {items.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeName === tab.screen.name;
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.screen)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-white text-emerald-700' : 'text-emerald-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
          {showBell && <NotificationBell />}
        </div>
      </nav>
      <div className="hidden h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 md:block" />
    </div>
  );
};