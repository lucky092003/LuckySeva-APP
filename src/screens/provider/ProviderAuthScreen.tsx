import { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  User,
  ArrowRight,
  Wrench,
  Briefcase,
  LocateFixed,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { OtpSection } from '@/components/OtpInput';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { fetchCurrentLocation, areaFrom } from '@/lib/location';
import type { Professional } from '@/lib/types';

function categoryFor(profession: string): string {
  const p = profession.toLowerCase();
  if (/plumb|tap|leak|pipe|drain/.test(p)) return 'plumber';
  if (/electr|wire|inverter|switch/.test(p)) return 'electrician';
  if (/ac|air\s?cond/.test(p)) return 'ac-repair';
  if (/clean|housekeeping/.test(p)) return 'cleaning';
  if (/carpent|wood|furniture/.test(p)) return 'carpenter';
  if (/paint|texture/.test(p)) return 'painting';
  if (/appliance|wash|fridge|microwave|geyser/.test(p)) return 'appliance-repair';
  if (/beauty|salon|hair|makeup|spa|facial/.test(p)) return 'beauty-salon';
  if (/pest|termite|roach/.test(p)) return 'pest-control';
  return 'other';
}

export const ProviderAuthScreen = () => {
  const { setProviderId, navigate } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    profession: '',
    experience: '',
    serviceArea: '',
  });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const fetchServiceArea = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      const area = areaFrom(loc.details) || loc.address;
      setForm((f) => ({ ...f, serviceArea: area }));
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const canSubmit =
    form.name.trim() &&
    form.phone.length >= 10 &&
    (mode === 'login' ? true : form.email.trim() && form.profession.trim());

  const handleDetails = () => {
    setError('');
    if (!canSubmit) return;
    setStep('otp');
  };

  const signInAs = async (pro: { id: string } | null) => {
    setProviderId(pro?.id || null);
    navigate({ name: 'provider-home' });
  };

  const verifyOtp = async (code?: string) => {
    setError('');
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    if (!form.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    const name = form.name.trim();
    const phone = form.phone;
    if (!form.profession.trim()) {
      setError('Please enter your profession.');
      return;
    }
    try {
      const { data: existing } = await supabase
        .from('professionals')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      if (existing) return signInAs(existing as Professional);

      const profession = form.profession.trim();
      const { data } = await supabase
        .from('professionals')
        .insert({
          name,
          category_slug: categoryFor(profession),
          skills: [profession],
          experience_years: Number(form.experience) || 1,
          rating: 0,
          reviews_count: 0,
          completed_jobs: 0,
          starting_price: 99,
          avatar_url: '',
          distance_km: 1.0,
          status: 'available',
          bio: `${profession} professional serving ${form.serviceArea}.`,
          service_area: form.serviceArea,
          phone,
          email: mode === 'signup' ? form.email.trim() : null,
        })
        .select('id')
        .maybeSingle();
      await supabase.from('profiles').upsert(
        { phone, name, email: mode === 'signup' ? form.email.trim() : '', location: form.serviceArea, role: 'provider' },
        { onConflict: 'phone' }
      );
      return signInAs((data as { id: string }) || null);
    } catch {
      setError('Could not create your account. Please try again.');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar bg-white px-6 pb-6 pt-10">
      <div className="mb-8 flex flex-col items-center">
        <Logo size={64} />
        <h1 className="mt-4 text-center text-2xl font-extrabold text-gray-900">
          {step === 'otp'
            ? 'Verify your number'
            : mode === 'signup'
            ? 'Join as a service provider'
            : 'Provider sign in'}
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          {step === 'otp'
            ? `Enter the OTP sent to ${form.phone}`
            : 'Earn by offering your skills, on your schedule'}
        </p>
      </div>

      {step === 'details' ? (
        <div className="space-y-4">
          <Field
            icon={<User size={18} />}
            placeholder="Full name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            icon={<Phone size={18} />}
            placeholder="Mobile number"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })}
          />
          {mode === 'signup' && (
            <>
              <Field
                icon={<Mail size={18} />}
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                icon={<Wrench size={18} />}
                placeholder="Profession (e.g. Plumber, Electrician)"
                value={form.profession}
                onChange={(v) => setForm({ ...form, profession: v })}
              />
              <Field
                icon={<Briefcase size={18} />}
                placeholder="Years of experience"
                type="number"
                value={form.experience}
                onChange={(v) => setForm({ ...form, experience: v.replace(/\D/g, '').slice(0, 2) })}
              />
              <Field
                icon={<MapPin size={18} />}
                placeholder="Service area"
                value={form.serviceArea}
                onChange={(v) => setForm({ ...form, serviceArea: v })}
              />
              <button
                onClick={fetchServiceArea}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                <LocateFixed size={16} />
                {locating ? 'Fetching your location...' : 'Use my current location'}
              </button>
              {locError && <p className="text-xs text-red-500">{locError}</p>}
            </>
          )}

          <Button onClick={handleDetails} disabled={!canSubmit} className="w-full">
            {mode === 'signup' ? 'Create account' : 'Login'} <ArrowRight size={18} />
          </Button>

          <button
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            className="w-full text-center text-sm text-gray-500"
          >
            {mode === 'signup' ? 'Already a provider? ' : "Don't have an account? "}
            <span className="font-semibold text-emerald-600">
              {mode === 'signup' ? 'Login' : 'Sign up'}
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <OtpSection
            phone={form.phone}
            onVerify={(code) => verifyOtp(code)}
            onBack={() => setStep('details')}
          />
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

const Field = ({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
    <span className="text-gray-400">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
    />
  </div>
);
