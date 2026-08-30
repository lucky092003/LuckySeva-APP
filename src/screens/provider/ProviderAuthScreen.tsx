import { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  User,
  ArrowRight,
  Wrench,
  Briefcase,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { OtpSection } from '@/components/OtpInput';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import type { Professional } from '@/lib/types';

const SERVICE_AREAS = [
  'Koramangala, Bangalore',
  'Indiranagar, Bangalore',
  'Whitefield, Bangalore',
  'HSR Layout, Bangalore',
  'Electronic City, Bangalore',
];

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
  const { setRole, setProviderId, navigate } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    profession: '',
    experience: '',
    serviceArea: SERVICE_AREAS[0],
  });

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
    setRole('provider');
    navigate({ name: 'provider-home' });
  };

  const verifyOtp = async () => {
    setError('');
    const name = form.name.trim();
    const phone = form.phone;
    try {
      const { data: existing } = await supabase
        .from('professionals')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      if (existing) return signInAs(existing as Professional);

      const profession = form.profession.trim() || 'Handyman';
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
          avatar_url: 'https://i.pravatar.cc/200?img=68',
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

  const googleSignIn = async () => {
    setError('');
    const phone = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
    try {
      const { data } = await supabase
        .from('professionals')
        .insert({
          name: 'Provider (Google)',
          category_slug: 'other',
          skills: ['General services'],
          experience_years: 1,
          starting_price: 149,
          avatar_url: 'https://i.pravatar.cc/200?img=68',
          distance_km: 1.0,
          status: 'available',
          bio: 'New provider on LuckySeva.',
          service_area: form.serviceArea,
          phone,
        })
        .select('id')
        .maybeSingle();
      return signInAs((data as { id: string }) || null);
    } catch {
      setError('Could not sign you in. Please try again.');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-white px-6 pb-6 pt-10">
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
                dropdown={SERVICE_AREAS}
              />
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

          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <button onClick={googleSignIn} className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M16.51 8.18c0-.55-.05-1.08-.14-1.59H9v3.01h4.21a3.6 3.6 0 0 1-1.56 2.36v1.96h2.52c1.48-1.36 2.34-3.37 2.34-5.74z" fill="#4285F4"/><path d="M9 17c2.11 0 3.88-.7 5.17-1.9l-2.52-1.96c-.7.47-1.6.75-2.65.75-2.04 0-3.77-1.38-4.39-3.23H2v2.03A8 8 0 0 0 9 17z" fill="#34A853"/><path d="M4.61 10.66A4.8 4.8 0 0 1 4.35 9c0-.58.1-1.14.26-1.66V5.31H2a8 8 0 0 0 0 7.38l2.61-2.03z" fill="#FBBC05"/><path d="M9 4.15c1.15 0 2.18.4 2.99 1.17l2.24-2.24C12.88 1.85 11.11 1 9 1A8 8 0 0 0 2 5.31l2.61 2.03C5.23 5.53 6.96 4.15 9 4.15z" fill="#EA4335"/></svg>
            Continue with Google
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
  dropdown,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dropdown?: string[];
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
    <span className="text-gray-400">{icon}</span>
    {dropdown ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none"
      >
        {dropdown.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
    )}
  </div>
);
