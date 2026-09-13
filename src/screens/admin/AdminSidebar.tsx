import * as Icons from 'lucide-react';
import { useApp, Screen } from '@/lib/app-context';
import { Logo } from '@/components/Logo';

type NavItem = { label: string; icon: typeof Icons.Home; screen: Screen };

const MAIN: NavItem[] = [
  { label: 'Dashboard', icon: Icons.LayoutDashboard, screen: { name: 'admin-dashboard' } },
  { label: 'Bookings', icon: Icons.CalendarCheck, screen: { name: 'admin-bookings' } },
  { label: 'Customers', icon: Icons.Users, screen: { name: 'admin-customers' } },
  { label: 'Providers', icon: Icons.Wrench, screen: { name: 'admin-providers' } },
  { label: 'Services', icon: Icons.Tags, screen: { name: 'admin-services' } },
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
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      <span className="flex-1 text-left">{item.label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
};

export const AdminSidebar = () => {
  const { screen, setAdminAuthed, navigate } = useApp();

  const logout = () => {
    setAdminAuthed(false);
    navigate({ name: 'admin-auth' });
  };

  const isActive = (s: Screen) => screen.name === s.name;

  return (
    <div className="flex w-64 shrink-0 flex-col bg-gray-900 text-gray-400">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Logo size={38} />
        <div>
          <p className="text-base font-bold text-white">LuckySeva</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Admin Console
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Main
          </p>
          {MAIN.map((item) => (
            <AdminNavItem key={item.label} item={item} active={isActive(item.screen)} />
          ))}
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Account
          </p>
          {ACCOUNT.map((item) => (
            <AdminNavItem key={item.label} item={item} active={isActive(item.screen)} />
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">Super Admin</p>
            <p className="truncate text-[10px] text-gray-500">platform@luckyseva.in</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Icons.LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
};