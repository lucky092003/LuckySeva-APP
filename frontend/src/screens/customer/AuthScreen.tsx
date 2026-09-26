import { useState } from 'react';
import { Phone, Mail, MapPin, User, ArrowRight, LocateFixed } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { OtpSection } from '@/components/OtpInput';
import { useApp } from '@/context/app-context';
import { api, setApiToken } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';

export const AuthScreen = () => {
  const { navigate, setCustomer } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
  });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const fetchLocation = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      setForm((f) => ({ ...f, location: loc.address }));
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const canSubmit =
    form.name.trim() && form.phone.length >= 10 && (mode === 'login' || form.email.trim());

  const handleDetails = () => {
    setError('');
    if (!canSubmit) return;
    setStep('otp');
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
    const email = mode === 'signup' ? form.email.trim() : '';
    try {
      const res = await api.auth.verifyOtp({
        phone,
        code,
        role: 'customer',
        name,
        email: email || undefined,
        location: form.location || undefined,
      });
      setApiToken(res.access_token);
      const profile = res.profile;
      setCustomer({
        name: profile?.name || name,
        phone,
        email: profile?.email || email || '',
        location: profile?.location || form.location,
      });
      navigate({ name: 'home' });
    } catch {
      setError('Could not sign you in. Please try again.');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar bg-white px-6 pb-6 pt-10 md:mx-auto md:w-full md:max-w-md md:pt-16">
      <div className="mb-8 flex flex-col items-center">
        <Logo size={64} />
        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
          {step === 'otp' ? 'Verify your number' : mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 'otp'
            ? `Enter the OTP sent to ${form.phone}`
            : 'Trusted services, at your doorstep'}
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
            <Field
              icon={<Mail size={18} />}
              placeholder="Email address"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
          )}
          <Field
            icon={<MapPin size={18} />}
            placeholder="Location"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
            right={
              <button
                type="button"
                onClick={fetchLocation}
                disabled={locating}
                title="Use my current location"
                className="shrink-0 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              >
                <LocateFixed size={18} className={locating ? 'animate-spin' : ''} />
              </button>
            }
          />
          {locError && <p className="text-center text-xs text-red-500">{locError}</p>}

          <Button onClick={handleDetails} disabled={!canSubmit} className="w-full">
            {mode === 'signup' ? 'Send OTP' : 'Login'} <ArrowRight size={18} />
          </Button>

          <button
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            className="w-full text-center text-sm text-gray-500"
          >
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
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
  right,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  right?: React.ReactNode;
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
    {right}
  </div>
);
