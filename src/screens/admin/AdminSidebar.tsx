import * as Icons from 'lucide-react';
import { useApp, Screen } from '@/lib/app-context';

const NAV: { label: string; icon: typeof Icons.Home; screen: Screen }[] = [
  { label: 'Dashboard', icon: Icons.LayoutDashboard, screen: { name: 'admin-dashboard' } },
  { label: 'Customers', icon: Icons.Users, screen: { name: 'admin-customers' } },
  { label: 'Providers', icon: Icons.Wrench, screen: { name: 'admin-providers' } },
  { label: 'Services', icon: Icons.Tags, screen: { name: 'admin-services' } },
  { label: 'Bookings', icon: Icons.CalendarCheck, screen: { name: 'admin-bookings' } },
];

export const AdminSidebar = () => {
  const { screen, navigate } = useApp();
  return (
    <div className="flex shrink-0 flex-col border-r border-gray-100 bg-white px-2 py-3">
      {NAV.map((item) => {
        const active = screen.name === item.screen.name;
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.screen)}
            className={`mb-1 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-[10px] font-semibold transition-all ${active ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
