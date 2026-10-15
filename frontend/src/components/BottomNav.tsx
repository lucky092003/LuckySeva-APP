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
    <div className={`relative z-10 flex w-full flex-none shrink-0 items-stretch justify-around border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.875rem)] min-h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] ${hideOnDesktop}`}>
      {items.map((tab) => {
        const isActive = activeName === tab.screen.name;
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.screen)}
            className="flex min-h-[3.25rem] flex-1 min-w-0 flex-col items-center justify-center gap-1 py-1 touch-manipulation active:scale-95 transition-transform"
          >
            <Icon
              size={23}
              className={`shrink-0 ${isActive ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span className={`max-w-full truncate text-xs leading-tight font-semibold tracking-tight ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
