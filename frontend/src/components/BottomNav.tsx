import { Home, CalendarCheck, LayoutGrid, User } from 'lucide-react';
import { useApp, Screen } from '@/context/app-context';
import { isNative } from '@/utils/native';

const tabs: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: 'Home', icon: Home, screen: { name: 'home' } },
  { label: 'Bookings', icon: CalendarCheck, screen: { name: 'bookings' } },
  { label: 'Services', icon: LayoutGrid, screen: { name: 'services' } },
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
  if (screen.name === 'auth' || screen.name === 'provider-auth') return null;

  const items = role === 'provider' ? providerTabs : tabs;
  const activeName = screen.name;
  const hideOnDesktop = isNative ? '' : ' md:hidden';

  return (
    <div className={`relative z-10 flex w-full flex-none shrink-0 items-stretch justify-around border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-[max(0.5rem,env(safe-area-inset-left))] pt-1.5 pb-[max(1.5vh,calc(env(safe-area-inset-bottom)+0.75rem))] min-h-[calc(3.75rem+env(safe-area-inset-bottom))]${hideOnDesktop}`}>
      {items.map((tab) => {
        const isActive = activeName === tab.screen.name;
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.screen)}
            className="flex min-h-[3rem] flex-1 min-w-0 flex-col items-center justify-center gap-[0.25vh] py-1 active:scale-95 transition-transform"
          >
            <Icon
              size={22}
              className={`shrink-0 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span className={`max-w-full truncate text-[min(2.8vw,11px)] leading-tight font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
