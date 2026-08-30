import { Home, CalendarCheck, LayoutGrid, User } from 'lucide-react';
import { useApp, Screen, Role } from '@/lib/app-context';

const tabs: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Home', icon: Home, screen: { name: 'home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'bookings' } },
  { label: 'Services', icon: LayoutGrid, screen: { name: 'home' } },
  { label: 'Profile', icon: User, screen: { name: 'profile' } },
];

const providerTabs: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Requests', icon: Home, screen: { name: 'provider-home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'provider-bookings' } },
  { label: 'Earnings', icon: LayoutGrid, screen: { name: 'provider-earnings' } },
  { label: 'Profile', icon: User, screen: { name: 'provider-profile' } },
];

export const BottomNav = () => {
  const { screen, navigate, role } = useApp();
  if (role === 'admin') return null;

  const items = role === 'provider' ? providerTabs : tabs;
  const activeName = screen.name;

  return (
    <div className="flex shrink-0 items-stretch justify-around border-t border-gray-100 bg-white px-[max(0.5rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
      {items.map((tab) => {
        const isActive = activeName === tab.screen.name;
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.screen)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1"
          >
            <Icon
              size={22}
              className={isActive ? 'text-emerald-500' : 'text-gray-400'}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const RoleSwitcher = () => {
  const { role, setRole } = useApp();
  const roles: { key: Role; label: string }[] = [
    { key: 'customer', label: 'Customer' },
    { key: 'provider', label: 'Provider' },
    { key: 'admin', label: 'Admin' },
  ];
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white/90 p-1 shadow-lg backdrop-blur">
        {roles.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              role === r.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
};
