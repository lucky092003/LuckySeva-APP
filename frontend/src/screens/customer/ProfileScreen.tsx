import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { useBookings, useFavourites, useUnreadNotifications } from '@/hooks';
import { api, setApiToken } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button } from '@/components/ui';

const PAYMENT_METHODS = [
  { key: 'upi', label: 'UPI', desc: 'GPay, PhonePe, Paytm' },
  { key: 'card', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay' },
  { key: 'netbanking', label: 'Net Banking', desc: 'All major Indian banks' },
  { key: 'cash', label: 'Cash on service', desc: 'Pay the professional' },
];

export const ProfileScreen = () => {
  const { customer, setCustomer, navigate } = useApp();
  const { bookings } = useBookings('completed', customer?.phone || undefined);
  const { favourites } = useFavourites(customer?.phone || null);
  const { unread } = useUnreadNotifications(customer?.phone || null);
  const [editing, setEditing] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({ name: '', email: '', location: '' });
  const [detecting, setDetecting] = useState(false);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const loc = await fetchCurrentLocation();
      setForm((f) => ({ ...f, location: loc.address }));
    } catch {
      /* ignore */
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (customer) setForm({ name: customer.name, email: customer.email, location: customer.location });
  }, [customer]);

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        <TopBar title="Profile" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Icons.User size={40} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-800">You're not signed in</p>
          <Button onClick={() => navigate({ name: 'auth' })}>Sign in</Button>
        </div>
      </div>
    );
  }

  const saveCurrentLocation = async () => {
    setDetecting(true);
    try {
      const loc = await fetchCurrentLocation();
      await api.customer.updateProfile({ location: loc.address });
      setCustomer({ ...customer, location: loc.address });
    } catch {
      /* ignore */
    } finally {
      setDetecting(false);
    }
  };

  const saveProfile = async () => {
    await api.customer.updateProfile({ name: form.name, email: form.email, location: form.location }).catch(() => {});
    setCustomer({ ...customer, name: form.name, email: form.email, location: form.location });
    setEditing(false);
  };

  const copyReferral = async () => {
    const code = 'LUCKY' + customer.phone.slice(-4);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Profile" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Profile card */}
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xl font-bold text-white">
            {customer.name.split(' ').map((n) => n[0]).join('')}
          </div>
          {editing ? (
            <div className="min-w-0 flex-1 space-y-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              <button onClick={detectLocation} disabled={detecting} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
                {detecting ? 'Detecting...' : 'Use my current location'}
              </button>
              <div className="flex gap-2">
                <Button onClick={saveProfile} className="flex-1 py-2 text-xs">Save</Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 py-2 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-gray-900">{customer.name}</p>
              <p className="truncate text-xs text-gray-500">{customer.email || 'No email added'}</p>
              <p className="text-xs text-gray-500">{customer.phone}</p>
            </div>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <Icons.Pencil size={16} />
            </button>
          )}
        </Card>

        {/* Location */}
        <Card className="mt-3 flex items-center gap-3 p-4">
          <Icons.MapPin size={18} className="text-emerald-500" />
          <div className="flex-1">
            <p className="text-[11px] text-gray-400">Current Location</p>
            <p className="text-sm font-semibold text-gray-900">{customer.location || 'Not set'}</p>
          </div>
          <button onClick={saveCurrentLocation} disabled={detecting} className="text-emerald-500" title="Detect current location">
            <Icons.LocateFixed size={18} />
          </button>
          <button onClick={() => navigate({ name: 'addresses' })} className="text-gray-300">
            <Icons.ChevronRight size={18} />
          </button>
        </Card>

        {/* Menu */}
        <div className="mt-4 space-y-2">
          <MenuItem icon={<Icons.MapPin size={18} />} label="Saved Addresses" value="Manage" onClick={() => navigate({ name: 'addresses' })} />
          <MenuItem icon={<Icons.CreditCard size={18} />} label="Payment Methods" value="UPI, Card" onClick={() => setShowPayments(true)} />
          <MenuItem icon={<Icons.History size={18} />} label="Booking History" value={`${bookings.length} completed`} onClick={() => navigate({ name: 'bookings' })} />
          <MenuItem icon={<Icons.Heart size={18} />} label="Favourites" value={`${favourites.length} providers`} onClick={() => navigate({ name: 'favourites' })} />
          <MenuItem icon={<Icons.HeadphonesIcon size={18} />} label="Help & Support" value="" onClick={() => navigate({ name: 'help' })} />
          <MenuItem icon={<Icons.Bell size={18} />} label="Notifications" value={`${unread} new`} onClick={() => navigate({ name: 'notifications' })} />
          <MenuItem icon={<Icons.Settings size={18} />} label="Settings" value="" onClick={() => setShowSettings(true)} />
        </div>

        {/* Refer */}
        <button onClick={copyReferral} className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-left text-white">
          <Icons.Percent size={22} />
          <div className="flex-1">
            <p className="text-sm font-bold">{copied ? `Copied code ${copied}!` : 'Refer & Earn ₹100'}</p>
            <p className="text-xs text-white/90">{copied ? 'Share it with a friend' : 'Invite friends, both get rewards'}</p>
          </div>
          <Icons.ChevronRight size={18} />
        </button>

        <Button variant="outline" onClick={() => { setApiToken(null); setCustomer(null); navigate({ name: 'auth' }); }} className="mt-4 w-full text-red-500">
          <Icons.LogOut size={16} /> Logout
        </Button>

        <p className="mt-4 text-center text-[10px] text-gray-400">LuckySeva v1.0.0 · Trusted Services</p>
      </div>

      {/* Payment methods sheet */}
      {showPayments && (
        <Sheet onClose={() => setShowPayments(false)} title="Payment Methods">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.key} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
              <input
                type="radio"
                name="paymethod"
                defaultChecked={m.key === (localStorage.getItem('luckyseva.paymentMethod') || 'upi')}
                onChange={() => localStorage.setItem('luckyseva.paymentMethod', m.key)}
                className="accent-emerald-500"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                <p className="text-[11px] text-gray-400">{m.desc}</p>
              </div>
              <Icons.CheckCircle size={18} className="text-emerald-500" />
            </label>
          ))}
          <Button onClick={() => setShowPayments(false)} className="w-full">Done</Button>
        </Sheet>
      )}

      {/* Settings sheet */}
      {showSettings && (
        <Sheet onClose={() => setShowSettings(false)} title="Settings">
          <SettingToggle label="Push notifications" storageKey="luckyseva.push" />
          <SettingToggle label="Email updates" storageKey="luckyseva.email" />
          <SettingToggle label="SMS alerts" storageKey="luckyseva.sms" />
        </Sheet>
      )}
    </div>
  );
};

const MenuItem = ({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:shadow-sm">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600">{icon}</div>
    <span className="flex-1 text-sm font-medium text-gray-900">{label}</span>
    {value && <span className="text-xs text-gray-400">{value}</span>}
    <Icons.ChevronRight size={16} className="text-gray-300" />
  </button>
);

const Sheet = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="absolute inset-0 z-40 flex flex-col bg-white/60 backdrop-blur-sm">
    <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-4">
      <p className="flex-1 text-base font-bold text-gray-900">{title}</p>
      <button onClick={onClose} className="text-gray-400"><Icons.X size={22} /></button>
    </div>
    <div className="flex flex-1 flex-col space-y-2.5 overflow-y-auto no-scrollbar bg-gray-50 p-4">{children}</div>
  </div>
);

const SettingToggle = ({ label, storageKey }: { label: string; storageKey: string }) => {
  const [on, setOn] = useState<boolean>(() => (localStorage.getItem(storageKey) ?? 'on') === 'on');
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <button
        onClick={() => {
          const next = !on;
          localStorage.setItem(storageKey, next ? 'on' : 'off');
          setOn(next);
        }}
        className={`h-6 w-11 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};