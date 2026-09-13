import { Home, CalendarCheck, LayoutGrid, User } from 'lucide-react';
import { useApp, Screen, Role } from '@/lib/app-context';
import { Logo, Wordmark } from '@/components/Logo';
import { isNative } from '@/lib/native';

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
    <nav className="hidden shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3 md:flex">
      <button onClick={() => navigate(items[0].screen)} className="flex items-center gap-2">
        <Logo size={32} />
        <Wordmark />
      </button>
      <div className="flex items-center gap-1">
        {items.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeName === tab.screen.name;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.screen)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-50 text-emerald-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};