import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { useBookings, useFavourites, useUnreadNotifications } from '@/hooks';
import { api, setApiToken } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';

const PAYMENT_METHODS = [
  { key: 'upi', label: 'UPI', desc: 'GPay, PhonePe, Paytm' },
  { key: 'card', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay' },
  { key: 'netbanking', label: 'Net Banking', desc: 'All major Indian banks' },
  { key: 'cash', label: 'Cash on service', desc: 'Pay the professional' },
];

export const ProfileScreen = () => {
  const { customer, setCustomer, navigate } = useApp();
  const { theme, setTheme } = useTheme();
  const { bookings } = useBookings('completed', customer?.phone || undefined);
  const { favourites } = useFavourites(customer?.phone || null);
  const { unread } = useUnreadNotifications(customer?.phone || null);
  const [editing, setEditing] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState('');
  const [ref, setRef] = useState<{ code: string | null; invited: number; earned: number; reward_per_friend: number; my_referee_coupon: string | null } | null>(null);
  const [claim, setClaim] = useState('');
  const [claimMsg, setClaimMsg] = useState('');
  const [claiming, setClaiming] = useState(false);
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

  useEffect(() => {
    api.customer.referralMe().then(setRef).catch(() => setRef(null));
  }, [customer?.phone]);

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <TopBar title="Profile" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Icons.User size={40} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">You're not signed in</p>
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
    const code = ref?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const shareReferral = async () => {
    const code = ref?.code;
    if (!code) return;
    const text = `Use my LuckySeva referral code ${code} — you get ₹100 off your first booking, I earn ₹100 too!`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'LuckySeva', text });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    copyReferral();
  };

  const claimReferral = async () => {
    if (!claim.trim() || claiming) return;
    setClaiming(true);
    setClaimMsg('');
    try {
      const res = await api.customer.claimReferral(claim.trim());
      const coupon = res.referee_coupon;
      if (coupon) {
        try {
          await navigator.clipboard.writeText(coupon.code);
        } catch {
          /* ignore */
        }
        setClaimMsg(`🎉 Coupon ${coupon.code} copied — ₹${coupon.discount_value} off your first booking!`);
      } else {
        setClaimMsg('Referral applied!');
      }
      setClaim('');
      const fresh = await api.customer.referralMe();
      setRef(fresh);
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : 'Could not apply this code. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <TopBar
        title="Profile"
        showBack={false}
        right={
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-amber-300"
          >
            {theme === 'dark' ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
          </button>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4 dark:bg-gray-950">
        {/* Profile card */}
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xl font-bold text-white">
            {customer.name.split(' ').map((n) => n[0]).join('')}
          </div>
          {editing ? (
            <div className="min-w-0 flex-1 space-y-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <button onClick={detectLocation} disabled={detecting} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                {detecting ? 'Detecting...' : 'Use my current location'}
              </button>
              <div className="flex gap-2">
                <Button onClick={saveProfile} className="flex-1 py-2 text-xs">Save</Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 py-2 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{customer.name}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{customer.email || 'No email added'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
            </div>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              <Icons.Pencil size={16} />
            </button>
          )}
        </Card>

        {/* Location */}
        <Card className="mt-3 flex items-center gap-3 p-4">
          <Icons.MapPin size={18} className="text-emerald-500" />
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Current Location</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.location || 'Not set'}</p>
          </div>
          <button onClick={saveCurrentLocation} disabled={detecting} className="text-emerald-500" title="Detect current location">
            <Icons.LocateFixed size={18} />
          </button>
          <button onClick={() => navigate({ name: 'addresses' })} className="text-gray-300 dark:text-gray-600">
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
          <MenuItem icon={<Icons.Bell size={18} />} label="Notifications" value={unread > 0 ? `${unread > 9 ? '9+' : unread} new` : ''} onClick={() => navigate({ name: 'notifications' })} />
          <MenuItem icon={<Icons.Settings size={18} />} label="Settings" value="" onClick={() => setShowSettings(true)} />
        </div>

        {/* Refer */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-600">
          <div className="flex items-center gap-3 p-4 text-white">
            <Icons.Gift size={22} />
            <div className="flex-1">
              <p className="text-sm font-bold">{copied ? `Copied ${copied}!` : 'Refer & Earn ₹100'}</p>
              <p className="text-xs text-white/90">
                {ref?.code
                  ? `Your code: ${ref.code}`
                  : 'Loading your code…'}
              </p>
            </div>
            <button
              onClick={copyReferral}
              disabled={!ref?.code}
              title="Copy code"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              {copied ? <Icons.Check size={16} /> : <Icons.Copy size={16} />}
            </button>
            <button
              onClick={shareReferral}
              disabled={!ref?.code}
              title="Share code"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              <Icons.Share2 size={16} />
            </button>
          </div>
          <div className="border-t border-white/20 px-4 py-3 text-white">
            <p className="text-[11px] text-white/80">
              {ref
                ? `${ref.invited} friend${ref.invited === 1 ? '' : 's'} joined · ₹${ref.earned} earned`
                : 'Invite friends — both get ₹100'}
            </p>
            {!ref?.my_referee_coupon && !claimMsg && (
              <div className="mt-2 flex gap-2">
                <input
                  value={claim}
                  onChange={(e) => setClaim(e.target.value.toUpperCase())}
                  placeholder="Have a friend's code?"
                  maxLength={12}
                  className="min-w-0 flex-1 rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-xs text-white placeholder:text-white/60 focus:outline-none"
                />
                <button
                  onClick={claimReferral}
                  disabled={!claim.trim() || claiming}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50"
                >
                  {claiming ? '…' : 'Apply'}
                </button>
              </div>
            )}
            {claimMsg && <p className="mt-2 rounded-lg bg-white/20 px-3 py-1.5 text-[11px]">{claimMsg}</p>}
          </div>
        </div>

        <Button variant="outline" onClick={() => { setApiToken(null); setCustomer(null); navigate({ name: 'auth' }); }} className="mt-4 w-full text-red-500">
          <Icons.LogOut size={16} /> Logout
        </Button>

        <p className="mt-4 text-center text-[10px] text-gray-400 dark:text-gray-600">LuckySeva v1.0.0 · Trusted Services</p>
      </div>

      {/* Payment methods sheet */}
      {showPayments && (
        <Sheet onClose={() => setShowPayments(false)} title="Payment Methods">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.key} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <input
                type="radio"
                name="paymethod"
                defaultChecked={m.key === (localStorage.getItem('luckyseva.paymentMethod') || 'upi')}
                onChange={() => localStorage.setItem('luckyseva.paymentMethod', m.key)}
                className="accent-emerald-500"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{m.desc}</p>
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
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{icon}</div>
    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
    {value && <span className="text-xs text-gray-400 dark:text-gray-500">{value}</span>}
    <Icons.ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
  </button>
);

const Sheet = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="absolute inset-0 z-40 flex flex-col bg-white/60 backdrop-blur-sm dark:bg-gray-950/60">
    <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="flex-1 text-base font-bold text-gray-900 dark:text-gray-100">{title}</p>
      <button onClick={onClose} className="text-gray-400 dark:text-gray-500"><Icons.X size={22} /></button>
    </div>
    <div className="flex flex-1 flex-col space-y-2.5 overflow-y-auto no-scrollbar bg-gray-50 p-4 dark:bg-gray-950">{children}</div>
  </div>
);

const SettingToggle = ({ label, storageKey }: { label: string; storageKey: string }) => {
  const [on, setOn] = useState<boolean>(() => (localStorage.getItem(storageKey) ?? 'on') === 'on');
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <button
        onClick={() => {
          const next = !on;
          localStorage.setItem(storageKey, next ? 'on' : 'off');
          setOn(next);
        }}
        className={`h-6 w-11 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};