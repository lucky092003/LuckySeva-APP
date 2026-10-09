import * as Icons from 'lucide-react';
import { useApp, Screen } from '@/context/app-context';
import { Logo } from '@/components/Logo';
import { useAdminTheme } from '@/context/AdminThemeContext';

type NavItem = { label: string; icon: typeof Icons.Home; screen: Screen };

const MAIN: NavItem[] = [
  { label: 'Dashboard', icon: Icons.LayoutDashboard, screen: { name: 'admin-dashboard' } },
  { label: 'Bookings', icon: Icons.CalendarCheck, screen: { name: 'admin-bookings' } },
  { label: 'Customers', icon: Icons.Users, screen: { name: 'admin-customers' } },
  { label: 'Providers', icon: Icons.Wrench, screen: { name: 'admin-providers' } },
  { label: 'Services', icon: Icons.Tags, screen: { name: 'admin-services' } },
  { label: 'Coupons', icon: Icons.Ticket, screen: { name: 'admin-coupons' } as Screen },
  { label: 'Payouts', icon: Icons.Wallet, screen: { name: 'admin-payouts' } as Screen },
  { label: 'Refunds', icon: Icons.Undo, screen: { name: 'admin-refunds' } as Screen },
  { label: 'Disputes', icon: Icons.AlertTriangle, screen: { name: 'admin-disputes' } as Screen },
];

const ACCOUNT: NavItem[] = [
  { label: 'Profile', icon: Icons.UserCircle, screen: { name: 'admin-profile' } },
];

const AdminNavItem = ({ item, active }: { item: NavItem; active: boolean }) => {
  const { navigate } = useApp();
  const Icon = item.icon;
  return (
    <button
      onClick={() => navigate(item.screen)}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
      style={{
        backgroundColor: active ? 'var(--admin-nav-active-bg)' : 'transparent',
        color: active ? 'white' : 'var(--admin-nav-text)',
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      <span className="flex-1 text-left">{item.label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
};

export const AdminSidebar = () => {
  const { screen, setAdminAuthed, navigate } = useApp();
  const { theme, toggleTheme } = useAdminTheme();

  const logout = () => {
    setAdminAuthed(false);
    navigate({ name: 'admin-auth' });
  };

  const isActive = (s: Screen) => screen.name === s.name;

  return (
    <div style={{ backgroundColor: 'var(--admin-nav-bg)', color: 'var(--admin-nav-text)' }} className="flex w-64 shrink-0 flex-col border-r border-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <p className="text-base font-bold text-white">LuckySeva</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Admin Console
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{ color: 'var(--admin-nav-text)' }}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-nav-text)', opacity: 0.6 }}>
            Main
          </p>
          {MAIN.map((item) => (
            <AdminNavItem key={item.label} item={item} active={isActive(item.screen)} />
          ))}
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-nav-text)', opacity: 0.6 }}>
            Account
          </p>
          {ACCOUNT.map((item) => (
            <AdminNavItem key={item.label} item={item} active={isActive(item.screen)} />
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white">
            @
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">@{'admin'}</p>
            <p className="truncate text-[10px]" style={{ color: 'var(--admin-nav-text)' }}>Administrator</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: 'var(--admin-nav-text)', borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Icons.LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
};
