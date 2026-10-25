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
  const hideOnDesktop = isNative ? '' : ' lg:hidden';

  return (
    <div className={`relative z-10 flex w-full flex-none shrink-0 items-stretch justify-around border-t border-gray-100 bg-white shadow-[0_-8px_30px_-20px_rgba(15,23,42,0.6)] dark:border-gray-800 dark:bg-gray-950 dark:shadow-[0_-8px_30px_-20px_rgba(0,0,0,0.9)] pl-[max(0.75rem,var(--safe-area-left))] pr-[max(0.75rem,var(--safe-area-right))] pt-1.5 pb-[calc(var(--safe-area-bottom)+0.9rem)] min-h-[calc(4.75rem+var(--safe-area-bottom))] ${hideOnDesktop}`}>
      {items.map((tab) => {
        const isActive = activeName === tab.screen.name;
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.screen)}
            aria-label={tab.label}
            className="group flex min-h-[3.25rem] flex-1 min-w-0 flex-col items-center justify-center gap-1 py-1 touch-manipulation transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
              <Icon
                size={22}
                className={`shrink-0 transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
                strokeWidth={isActive ? 2.6 : 2}
              />
            </div>
            <span className={`max-w-full truncate text-[11px] leading-tight font-semibold tracking-tight transition-colors ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
