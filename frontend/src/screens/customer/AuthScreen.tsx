import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  ArrowRight,
  ArrowLeft,
  Shield,
  Zap,
  Users,
  Heart,
  User,
  Mail,
  MapPin,
  LocateFixed,
  Pencil,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useApp } from '@/context/app-context';
import { api, setApiToken } from '@/services/api';
import { fetchCurrentLocation } from '@/services/location';

const ORANGE = '#FF6B00';
const ORANGE_BG = 'rgba(255, 107, 0, 0.08)';
const phoneRegex = /^[6-9]\d{9}$/;

const OrangeButton = ({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all focus-visible:ring-4 focus-visible:ring-[#FF6B00]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    style={{
      background: disabled || loading ? '#FFB380' : `linear-gradient(180deg, #FF7A1A 0%, ${ORANGE} 100%)`,
      boxShadow: disabled || loading ? 'none' : '0 10px 22px -8px rgba(255, 107, 0, 0.55)',
    }}
  >
    {loading ? (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    ) : (
      <>
        {children} <ArrowRight size={18} />
      </>
    )}
  </button>
);

const Field = ({
  icon,
  label,
  children,
  error,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  error?: boolean;
  right?: React.ReactNode;
}) => (
  <div>
    <label className="mb-2 block text-[13px] font-semibold text-gray-600">{label}</label>
    <div
      className={`flex h-[52px] items-center gap-3 rounded-2xl px-4 transition-all focus-within:ring-4 focus-within:ring-[#FF6B00]/10 ${
        error ? 'border border-red-400' : 'border border-gray-200 focus-within:border-[#FF6B00]'
      }`}
    >
      <span style={{ color: ORANGE }} className="shrink-0">
        {icon}
      </span>
      {children}
      {right}
    </div>
  </div>
);

const TrustFooter = () => (
  <div className="flex items-start justify-between gap-1 border-t border-gray-100 pt-4 pb-1">
    {[
      { Icon: Shield, label: 'Trusted Services' },
      { Icon: Zap, label: 'Fast & Easy' },
      { Icon: Users, label: 'For Everyone' },
      { Icon: Heart, label: 'Your Growth Partner' },
    ].map(({ Icon, label }) => (
      <div key={label} className="flex min-h-[44px] flex-1 flex-col items-center gap-1.5 px-1 text-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: ORANGE_BG }}>
          <Icon size={16} strokeWidth={2} style={{ color: ORANGE }} />
        </span>
        <span className="text-[9px] font-semibold leading-tight text-gray-500">{label}</span>
      </div>
    ))}
  </div>
);

export const AuthScreen = () => {
  const { navigate, setCustomer } = useApp();
  const [step, setStep] = useState<'phone' | 'signup' | 'otp' | 'signup-otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const validPhone = phoneRegex.test(phone);

  useEffect(() => {
    if (step === 'otp' || step === 'signup-otp') inputs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendOtp = async (isSignup: boolean) => {
    if (!validPhone || sending) return;
    setError('');
    setSending(true);
    try {
      await api.auth.verifyOtp({ phone, code: '000000', role: 'customer' }).catch(() => null);
    } finally {
      setSending(false);
      setDigits(Array(6).fill(''));
      setTimer(30);
      setStep(isSignup ? 'signup-otp' : 'otp');
    }
  };

  const setDigit = (i: number, v: string) => {
    const val = v.replace(/\D/g, '');
    if (val.length > 1) {
      const arr = val.slice(0, 6).split('');
      setDigits([...arr, ...Array(Math.max(0, 6 - arr.length)).fill('')]);
      inputs.current[Math.min(arr.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const code = digits.join('');

  const verifyOtp = async () => {
    if (code.length !== 6 || verifying) return;
    setError('');
    setVerifying(true);
    try {
      const isSignup = step === 'signup-otp';
      const res = await api.auth.verifyOtp({
        phone,
        code,
        role: 'customer',
        name: isSignup ? name.trim() : undefined,
        email: isSignup ? email.trim() || undefined : undefined,
        location: isSignup ? location || undefined : undefined,
      });
      setApiToken(res.access_token);
      const profile = res.profile;
      setCustomer({
        name: profile?.name || name.trim(),
        phone,
        email: profile?.email || email || '',
        location: profile?.location || location || '',
      });
      navigate({ name: 'home' });
    } catch {
      setError('Incorrect OTP. Please try again.');
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const prettyPhone = phone.replace(/^(\d{5})(\d{5})$/, '$1 $2');
  const isOtp = step === 'otp' || step === 'signup-otp';

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto no-scrollbar bg-white px-6 pb-8 pt-12 md:mx-auto md:w-full md:max-w-md md:pt-16">
      {/* Soft hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            'radial-gradient(70% 90% at 50% 0%, rgba(255, 107, 0, 0.09) 0%, rgba(255, 107, 0, 0.045) 45%, rgba(255, 255, 255, 0) 100%)',
        }}
      />

      {/* Logo */}
      <div className="relative mb-8 flex flex-col items-center">
        <div
          className="rounded-full ring-1 ring-black/5"
          style={{ boxShadow: '0 10px 28px -8px rgba(255, 107, 0, 0.35)' }}
        >
          <Logo size={68} className="rounded-full" />
        </div>
      </div>

      {step === 'phone' ? (
        <div className="relative flex flex-1 flex-col">
          <div className="mb-8">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-gray-900">Welcome Back</h1>
            <p className="mt-1.5 text-[15px] text-gray-500">
              Everything you need, right at your fingertips
            </p>
          </div>

          <Field icon={<Phone size={18} />} label="Mobile Number" error={phone.length > 0 && !validPhone}>
            <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-gray-900">
              +91
              <span className="h-4 w-px bg-gray-300" />
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Enter mobile number"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </Field>
          {phone.length > 0 && !validPhone && (
            <p className="mt-2 text-xs text-red-500">Enter a valid 10-digit Indian mobile number</p>
          )}

          <div className="mt-6">
            <OrangeButton onClick={() => sendOtp(false)} disabled={!validPhone} loading={sending}>
              Continue
            </OrangeButton>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setStep('signup')}
              className="h-11 font-semibold active:opacity-70"
              style={{ color: ORANGE }}
            >
              Sign up
            </button>
          </p>

          <div className="mt-8 flex-1" />

          <p className="mb-3 text-center text-xs leading-relaxed text-gray-400">
            By continuing, you agree to our{' '}
            <span className="font-semibold text-gray-600">Terms</span> &{' '}
            <span className="font-semibold text-gray-600">Privacy Policy</span>
          </p>

          <TrustFooter />
        </div>
      ) : step === 'signup' ? (
        <div className="relative flex flex-1 flex-col">
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setError('');
            }}
            className="-ml-2 mb-4 flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-50"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="mb-6">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-gray-900">Create Account</h1>
            <p className="mt-1.5 text-[15px] text-gray-500">
              Sign up and book trusted services instantly
            </p>
          </div>

          <div className="space-y-4">
            <Field icon={<User size={18} />} label="Full Name">
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field icon={<Mail size={18} />} label="Email Address">
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field icon={<Phone size={18} />} label="Mobile Number" error={phone.length > 0 && !validPhone}>
              <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-gray-900">
                +91
                <span className="h-4 w-px bg-gray-300" />
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Enter mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>
            {phone.length > 0 && !validPhone && (
              <p className="-mt-2 text-xs text-red-500">Enter a valid 10-digit Indian mobile number</p>
            )}

            <Field
              icon={<MapPin size={18} />}
              label="Location"
              right={
                <button
                  type="button"
                  onClick={async () => {
                    setLocating(true);
                    setLocError('');
                    try {
                      const loc = await fetchCurrentLocation();
                      setLocation(loc.address);
                    } catch (e) {
                      setLocError(
                        e instanceof Error
                          ? e.message
                          : 'Could not fetch your location. Please try again or type it manually.'
                      );
                    } finally {
                      setLocating(false);
                    }
                  }}
                  disabled={locating}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                  style={{ background: ORANGE_BG }}
                  title="Use my current location"
                >
                  <LocateFixed size={16} style={{ color: ORANGE }} className={locating ? 'animate-spin' : ''} />
                </button>
              }
            >
              <input
                type="text"
                placeholder="Enter your location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>
            {locError && <p className="-mt-2 text-xs text-red-500">{locError}</p>}
          </div>

          <div className="mt-7">
            <OrangeButton
              onClick={() => sendOtp(true)}
              disabled={!validPhone || !name.trim() || !email.trim()}
              loading={sending}
            >
              Create Account
            </OrangeButton>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
              }}
              className="h-11 font-semibold active:opacity-70"
              style={{ color: ORANGE }}
            >
              Login
            </button>
          </p>

          <div className="mt-8 flex-1" />

          <TrustFooter />
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col">
          <button
            type="button"
            onClick={() => {
              setStep(isOtp && step === 'signup-otp' ? 'signup' : 'phone');
              setError('');
            }}
            className="-ml-2 mb-4 flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-50"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="mb-7">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-gray-900">
              Verify your number
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-500">We've sent a 6-digit OTP to</p>
            <p className="mt-0.5 text-[15px] font-bold text-gray-900">+91 {prettyPhone}</p>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`OTP digit ${i + 1}`}
                className={`h-14 w-full min-w-0 rounded-2xl border-2 text-center text-xl font-extrabold text-gray-900 transition-all focus:outline-none focus:ring-4 ${
                  error
                    ? 'border-red-400 bg-red-50/50 focus:ring-red-100'
                    : d
                      ? 'bg-white focus:ring-[#FF6B00]/10'
                      : 'bg-gray-50 focus:border-[#FF6B00] focus:ring-[#FF6B00]/10'
                }`}
                style={{
                  borderColor: !error && d ? ORANGE : undefined,
                }}
              />
            ))}
          </div>
          {error && <p className="mt-3 text-center text-sm font-medium text-red-500">{error}</p>}

          <div className="mt-5 text-center text-sm text-gray-500">
            {timer > 0 ? (
              <p>
                Resend OTP in{' '}
                <span className="font-semibold tabular-nums text-gray-900">
                  00:{String(timer).padStart(2, '0')}
                </span>
              </p>
            ) : (
              <p>
                Didn't receive the OTP?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTimer(30);
                    setDigits(Array(6).fill(''));
                    setError('');
                    inputs.current[0]?.focus();
                  }}
                  className="font-semibold active:opacity-70"
                  style={{ color: ORANGE }}
                >
                  Resend OTP
                </button>
              </p>
            )}
          </div>

          <div className="mt-7">
            <OrangeButton onClick={verifyOtp} disabled={code.length !== 6} loading={verifying}>
              Verify & Continue
            </OrangeButton>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => {
              setStep(step === 'signup-otp' ? 'signup' : 'phone');
              setError('');
            }}
            className="mx-auto flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800"
          >
            <Pencil size={13} /> Change mobile number
          </button>
        </div>
      )}
    </div>
  );
};
