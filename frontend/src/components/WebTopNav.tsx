import { Home, CalendarCheck, LayoutGrid, User } from 'lucide-react';
import { useApp, Screen, Role } from '@/context/app-context';
import { Logo } from '@/components/Logo';
import { isNative } from '@/utils/native';

const customerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Home', icon: Home, screen: { name: 'home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'bookings' } },
  { label: 'Services', icon: LayoutGrid, screen: { name: 'home' } },
  { label: 'Profile', icon: User, screen: { name: 'profile' } },
];

const providerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Requests', icon: Home, screen: { name: 'provider-home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'provider-bookings' } },
  { label: 'Earnings', icon: LayoutGrid, screen: { name: 'provider-earnings' } },
  { label: 'Profile', icon: User, screen: { name: 'provider-profile' } },
];

export const WebTopNav = ({ role }: { role: Role }) => {
  const { screen, navigate } = useApp();
  if (isNative) return null;
  const items = role === 'provider' ? providerItems : role === 'admin' ? [] : customerItems;
  if (!items.length) return null;
  const activeName = screen.name;

  return (
    <div className="sticky top-0 z-50">
      <nav className="hidden shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 px-5 py-2 md:flex">
        <button onClick={() => navigate(items[0].screen)} className="flex items-center gap-2">
          <Logo size={36} />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-black">Lucky</span>
            <span className="text-orange-500">Seva</span>
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
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-emerald-50/60 hover:text-emerald-700'}`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="hidden h-0.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 md:block" />
    </div>
  );
};