import { useState } from 'react';
import { Phone, Mail, MapPin, User, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { OtpSection } from '@/components/OtpInput';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

export const AuthScreen = () => {
  const { navigate, setCustomer } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    location: 'Koramangala, Bangalore',
  });

  const canSubmit =
    form.name.trim() && form.phone.length >= 10 && (mode === 'login' || form.email.trim());

  const handleDetails = () => {
    setError('');
    if (!canSubmit) return;
    setStep('otp');
  };

  const verifyOtp = async () => {
    setError('');
    const name = form.name.trim() || 'Aarav Sharma';
    const phone = form.phone;
    const email = mode === 'signup' ? form.email.trim() : '';
    try {
      await supabase.from('profiles').upsert(
        {
          phone,
          name,
          email: email || null,
          location: form.location,
          role: 'customer',
        },
        { onConflict: 'phone' }
      );
      setCustomer({ name, phone, email: email || '', location: form.location });
      navigate({ name: 'home' });
    } catch {
      setError('Could not sign you in. Please try again.');
    }
  };

  const googleSignIn = async () => {
    setError('');
    const phone = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
    const name = 'Google User';
    try {
      await supabase
        .from('profiles')
        .upsert({ phone, name, email: 'google@example.com', location: form.location, role: 'customer' }, { onConflict: 'phone' });
      setCustomer({ name, phone, email: 'google@example.com', location: form.location });
      navigate({ name: 'home' });
    } catch {
      setError('Could not sign you in. Please try again.');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar bg-white px-6 pb-6 pt-10">
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
          />

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
