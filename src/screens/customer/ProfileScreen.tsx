import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useBookings } from '@/lib/hooks';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button } from '@/components/ui';
import { Screen } from '@/lib/app-context';

export const ProfileScreen = () => {
  const { customer, setCustomer, navigate, setRole } = useApp();
  const { bookings } = useBookings('completed', customer?.phone || '9876543210');

  const c = customer || { name: 'Aarav Sharma', phone: '9876543210', email: 'aarav@example.com', location: 'Koramangala, Bangalore' };

  const logout = () => {
    setCustomer(null);
    setRole('customer');
    navigate({ name: 'splash' });
  };

  const menuItems: { icon: typeof Icons.MapPin; label: string; value: string; screen?: Screen }[] = [
    { icon: Icons.MapPin, label: 'Saved Addresses', value: '3 saved', screen: { name: 'addresses' } },
    { icon: Icons.CreditCard, label: 'Payment Methods', value: 'UPI, Card' },
    { icon: Icons.History, label: 'Booking History', value: `${bookings.length} completed`, screen: { name: 'bookings' } },
    { icon: Icons.Heart, label: 'Favourites', value: '5 providers' },
    { icon: Icons.HeadphonesIcon, label: 'Help & Support', value: '', screen: { name: 'help' } },
    { icon: Icons.Bell, label: 'Notifications', value: '3 new', screen: { name: 'notifications' } },
    { icon: Icons.Settings, label: 'Settings', value: '' },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Profile" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Profile card */}
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xl font-bold text-white">
            {c.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-gray-900">{c.name}</p>
            <p className="truncate text-xs text-gray-500">{c.email}</p>
            <p className="text-xs text-gray-500">{c.phone}</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Icons.Pencil size={16} />
          </button>
        </Card>

        {/* Location */}
        <Card className="mt-3 flex items-center gap-3 p-4">
          <Icons.MapPin size={18} className="text-emerald-500" />
          <div className="flex-1">
            <p className="text-[11px] text-gray-400">Current Location</p>
            <p className="text-sm font-semibold text-gray-900">{c.location}</p>
          </div>
          <Icons.ChevronRight size={18} className="text-gray-300" />
        </Card>

        {/* Menu */}
        <div className="mt-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => item.screen && navigate(item.screen)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                  <Icon size={18} />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{item.label}</span>
                {item.value && <span className="text-xs text-gray-400">{item.value}</span>}
                <Icons.ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>

        {/* Offers */}
        <Card className="mt-4 flex items-center gap-3 bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white">
          <Icons.Percent size={22} />
          <div className="flex-1">
            <p className="text-sm font-bold">Refer & Earn ₹100</p>
            <p className="text-xs text-white/90">Invite friends, both get rewards</p>
          </div>
          <Icons.ChevronRight size={18} />
        </Card>

        <Button variant="outline" onClick={logout} className="mt-4 w-full text-red-500">
          <Icons.LogOut size={16} /> Logout
        </Button>

        <p className="mt-4 text-center text-[10px] text-gray-400">LuckySeva v1.0.0 · Trusted Services</p>
      </div>
    </div>
  );
};
