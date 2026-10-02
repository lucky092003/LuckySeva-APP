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
  Wrench,
  Briefcase,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { DevOtpHint } from '@/components/DevOtpHint';
import { useApp } from '@/context/app-context';
import { api, isSignupRequired, otpErrorMessage, setApiToken } from '@/services/api';
import { fetchCurrentLocation, areaFrom } from '@/services/location';

const ORANGE = '#FF6B00';
const ORANGE_SOFT = 'rgba(255, 107, 0, 0.10)';
const phoneRegex = /^[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Shown only if a backend answers with the signup_required code but no message.
const UNREGISTERED_FALLBACK = 'This number is not registered yet. Please sign up first.';

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
  if (/physio|physiotherap|rehab|exercise|massage/.test(p)) return 'physiotherapy';
  if (/packer|mover|shifting|relocation/.test(p)) return 'packer-mover';
  if (/cctv|camera|security|surveillance|alarm/.test(p)) return 'cctv-security';
  if (/laundry|dry\s?clean|launder|ironing/.test(p)) return 'laundry-dry-cleaning';
  if (/lawn|garden|landscap|terrace\s?garden|hedge/.test(p)) return 'lawn-garden';
  return 'other';
}

export const ProviderAuthScreen = () => {
  const { setProviderId, navigate } = useApp();
  const [step, setStep] = useState<'phone' | 'signup' | 'otp' | 'signup-otp'>('phone');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [professionTouched, setProfessionTouched] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    profession: '',
    experience: '',
    serviceArea: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const validPhone = phoneRegex.test(form.phone);
  const validEmail = emailRegex.test(form.email.trim());
  const badPhone = form.phone.length > 0 && !validPhone;
  const code = digits.join('');

  useEffect(() => {
    if (step === 'otp' || step === 'signup-otp') inputs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const fetchServiceArea = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      const area = areaFrom(loc.details) || loc.address;
      setForm((f) => ({ ...f, serviceArea: area, latitude: loc.latitude, longitude: loc.longitude }));
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const sendOtp = async (isSignup: boolean) => {
    if (!validPhone || sending) return;
    setError('');
    setSending(true);
    try {
      const res = await api.auth.requestOtp({
        phone: form.phone,
        role: 'provider',
        mode: isSignup ? 'signup' : 'login',
      });
      setDebugCode(res.debug_code || null);
      setDigits(Array(6).fill(''));
      setTimer(res.resend_after || 30);
      setStep(isSignup ? 'signup-otp' : 'otp');
    } catch (e) {
      if (!isSignup && isSignupRequired(e)) {
        // This number has never been signed up as a provider - show the form.
        setStep('signup');
        setError(otpErrorMessage(e, UNREGISTERED_FALLBACK));
        return;
      }
      setError(otpErrorMessage(e, 'Could not send the OTP. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const leaveOtpStep = () => {
    setStep(step === 'signup-otp' ? 'signup' : 'phone');
    setError('');
    setDebugCode(null);
    setDigits(Array(6).fill(''));
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

  const verifyOtp = async () => {
    if (code.length !== 6 || verifying) return;
    setError('');
    setVerifying(true);
    const isSignup = step === 'signup-otp';
    try {
      const profession = form.profession.trim();
      const res = await api.auth.verifyOtp({
        phone: form.phone,
        code,
        role: 'provider',
        mode: isSignup ? 'signup' : 'login',
        name: isSignup ? form.name.trim() : undefined,
        email: isSignup ? form.email.trim() || undefined : undefined,
        profession: isSignup ? profession : undefined,
        experience: isSignup ? Number(form.experience) || 1 : undefined,
        serviceArea: isSignup ? form.serviceArea : undefined,
        service_radius_km: isSignup ? 60 : undefined,
        latitude: isSignup ? form.latitude : undefined,
        longitude: isSignup ? form.longitude : undefined,
        category_slug: isSignup ? categoryFor(profession) : undefined,
      });
      setApiToken(res.access_token);
      setProviderId(res.professional_id || null);
      navigate({ name: 'provider-home' });
    } catch (e) {
      if (!isSignup && isSignupRequired(e)) {
        setStep('signup');
        setError(otpErrorMessage(e, UNREGISTERED_FALLBACK));
        return;
      }
      setError(
        otpErrorMessage(
          e,
          isSignup ? 'Could not create your account. Please try again.' : 'Incorrect OTP. Please try again.'
        )
      );
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const prettyPhone = form.phone.replace(/^(\d{5})(\d{5})$/, '$1 $2');

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto no-scrollbar bg-[#0C0C0F] md:min-h-full md:flex-row">
      {/* Dark header (mobile) / Branding panel (desktop) */}
      <div className="relative flex flex-col items-center px-6 pb-14 pt-10 md:w-[44%] md:min-w-[420px] md:justify-center md:pb-0 md:pt-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(255,123,28,0.5) 0%, rgba(255,123,28,0) 70%)' }}
          />
          <div
            className="absolute -right-16 top-2 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(255,184,90,0.35) 0%, rgba(255,184,90,0) 70%)' }}
          />
          <div
            className="absolute bottom-0 left-1/2 h-44 w-96 -translate-x-1/2 blur-2xl"
            style={{ background: 'radial-gradient(55% 65% at 50% 100%, rgba(255,107,0,0.45) 0%, rgba(255,107,0,0) 100%)' }}
          />
          <svg className="absolute inset-x-0 bottom-0" width="100%" height="90" viewBox="0 0 375 90" preserveAspectRatio="none">
            <defs>
              <linearGradient id="provider-auth-glow-wave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FF8A3D" stopOpacity="0.65" />
                <stop offset="1" stopColor="#FF6B00" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            <path
              d="M0 64 C 70 40, 150 78, 230 58 C 300 41, 350 62, 375 46 L 375 90 L 0 90 Z"
              fill="url(#provider-auth-glow-wave)"
            />
          </svg>
        </div>

        {/* Mobile logo */}
        <div
          className="relative rounded-full ring-4 ring-white md:hidden"
          style={{ boxShadow: '0 16px 34px -12px rgba(0, 0, 0, 0.65)' }}
        >
          <Logo size={96} className="rounded-full" />
        </div>

        {/* Desktop-only luxury brand panel */}
        <div className="relative z-10 hidden w-full max-w-[540px] md:mt-4 md:block md:mx-auto md:self-center">
          {/* Logo row */}
          <div className="flex items-center gap-3.5">
            <div
              className="rounded-full ring-4 ring-white/10"
              style={{ boxShadow: '0 18px 40px -14px rgba(255, 107, 0, 0.55)' }}
            >
              <Logo size={64} className="rounded-full" />
            </div>
            <p className="text-[24px] font-extrabold tracking-tight text-white">
              Lucky
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(120deg, #FFC27A 0%, #FF7E24 60%, #FF6B00 100%)' }}
              >
                Seva
              </span>
              <span className="ml-2 align-middle text-[10px] font-bold tracking-widest text-white/40">
                PARTNER
              </span>
            </p>
          </div>

          {/* Eyebrow pill */}
          <span
            className="mt-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold tracking-wide text-white/85"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 154, 69, 0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              className="h-2 w-2 rounded-full bg-[#FF7E24]"
              style={{ boxShadow: '0 0 12px rgba(255, 126, 36, 0.95)' }}
            />
            India's Trusted Partner Network
          </span>

          {/* Headline */}
          <h2 className="mt-6 text-[40px] font-extrabold leading-[1.1] tracking-tight text-white">
            Grow your business
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(100deg, #FFC27A 0%, #FF7E24 55%, #FF6B00 100%)' }}
            >
              with LuckySeva.
            </span>
          </h2>
          <p className="mt-5 max-w-[430px] text-[15px] leading-relaxed text-white/55">
            Get more jobs, set your own schedule and get paid on time — verified professionals
            preferred by homeowners across India.
          </p>

          {/* Quote strip */}
          <p className="mt-9 flex items-center gap-2 text-[12px] font-medium tracking-wide text-white/35">
            <Shield size={13} style={{ color: '#FF9A45' }} />
            Join thousands of professionals earning with LuckySeva
          </p>
        </div>
      </div>

      {/* White sheet (mobile) / Form column (desktop) */}
      <div className="relative flex w-full flex-1 flex-col rounded-t-[28px] bg-white pb-8 pt-8 shadow-[0_-12px_32px_rgba(0,0,0,0.18)] md:rounded-none md:shadow-none">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -mt-px h-1.5 rounded-t-[28px] md:hidden"
          style={{ background: 'linear-gradient(90deg, rgba(255,107,0,0.35), rgba(255,180,110,0.15), rgba(255,107,0,0.35))' }}
        />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 md:justify-center md:py-10">

      {step === 'phone' ? (
        <div className="relative flex flex-1 flex-col animate-[slideUp_0.4s_ease-out]">
          {/* Subtle professional waves (bottom decoration) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-8 -mx-6">
            <svg width="100%" height="76" viewBox="0 0 375 76" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="provider-login-wave-back" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF6B00" stopOpacity="0.04" />
                  <stop offset="1" stopColor="#FF8A3D" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="provider-login-wave-front" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F3F4F6" stopOpacity="0.92" />
                  <stop offset="1" stopColor="#E9EBEE" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M0 30 C 58 8, 126 46, 194 36 C 266 25, 322 42, 375 18 L 375 76 L 0 76 Z"
                fill="url(#provider-login-wave-back)"
              />
              <path
                d="M0 52 C 54 34, 120 68, 198 58 C 274 48, 330 66, 375 48 L 375 76 L 0 76 Z"
                fill="url(#provider-login-wave-front)"
              />
            </svg>
          </div>

          <div className="mb-7">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-gray-900">Welcome Back</h1>
            <p className="mt-1.5 text-[15px] text-gray-500">
              Sign in to manage your jobs and earnings
            </p>
          </div>

          <Field
            icon={<Phone size={18} />}
            label="Mobile Number"
            error={badPhone}
            errorText={badPhone ? 'Enter a valid 10-digit Indian mobile number' : undefined}
          >
            <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-gray-900">
              +91
              <span className="h-4 w-px bg-gray-300" />
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Enter mobile number"
              autoFocus
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-wide text-gray-900 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400 focus:outline-none"
            />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="mt-6">
            <OrangeButton onClick={() => sendOtp(false)} disabled={!validPhone} loading={sending}>
              Continue
            </OrangeButton>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setStep('signup');
                setError('');
              }}
              className="h-11 font-semibold underline-offset-2 active:opacity-70"
              style={{ color: ORANGE }}
            >
              Sign up
            </button>
          </p>

          <div className="mt-8 flex-1" />

          <div className="relative">
            <TrustFooter />
          </div>
        </div>
      ) : step === 'signup' ? (
        <div className="relative flex flex-1 flex-col animate-[slideUp_0.4s_ease-out]">
          {/* Subtle professional waves (bottom decoration) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-8 -mx-6">
            <svg width="100%" height="76" viewBox="0 0 375 76" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="provider-signup-wave-back" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF6B00" stopOpacity="0.04" />
                  <stop offset="1" stopColor="#FF8A3D" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="provider-signup-wave-front" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F3F4F6" stopOpacity="0.92" />
                  <stop offset="1" stopColor="#E9EBEE" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M0 30 C 58 8, 126 46, 194 36 C 266 25, 322 42, 375 18 L 375 76 L 0 76 Z"
                fill="url(#provider-signup-wave-back)"
              />
              <path
                d="M0 52 C 54 34, 120 68, 198 58 C 274 48, 330 66, 375 48 L 375 76 L 0 76 Z"
                fill="url(#provider-signup-wave-front)"
              />
            </svg>
          </div>

          <div className="mb-5">
            <h1 className="text-center text-[24px] font-extrabold leading-tight tracking-tight text-gray-800">
              Become a{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, #FF7E24 0%, #FF6B00 55%, #FF9440 100%)',
                }}
              >
                Partner
              </span>
            </h1>
            <p className="mt-1 text-center text-[14px] text-gray-400">
              Register to start earning with LuckySeva
            </p>
          </div>

          <div className="relative space-y-3">
            <Field
              icon={<User size={19} />}
              label="Full Name"
              hideLabel
              compact
              error={!form.name.trim() && nameTouched}
              errorText={!form.name.trim() && nameTouched ? 'Full name is required' : undefined}
            >
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onBlur={() => setNameTouched(true)}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field
              icon={<Mail size={19} />}
              label="Email Address"
              hideLabel
              compact
              error={form.email.length > 0 && !validEmail}
              errorText={form.email.length > 0 && !validEmail ? 'Enter a valid email address' : undefined}
            >
              <input
                type="email"
                inputMode="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field
              icon={<Phone size={19} />}
              label="Mobile Number"
              hideLabel
              compact
              error={badPhone}
              errorText={badPhone ? 'Enter a valid 10-digit Indian mobile number' : undefined}
            >
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Mobile Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field
              icon={<Wrench size={19} />}
              label="Profession"
              hideLabel
              compact
              error={professionTouched && !form.profession.trim()}
              errorText={professionTouched && !form.profession.trim() ? 'Profession is required' : undefined}
            >
              <input
                type="text"
                placeholder="Profession (e.g. Plumber)"
                onBlur={() => setProfessionTouched(true)}
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field
              icon={<Briefcase size={19} />}
              label="Years of Experience"
              hideLabel
              compact
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder="Years of Experience"
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>

            <Field
              icon={<MapPin size={19} />}
              label="Service Area"
              hideLabel
              compact
              errorText={locError || undefined}
              right={
                <button
                  type="button"
                  onClick={fetchServiceArea}
                  disabled={locating}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50"
                  style={{ background: ORANGE_SOFT }}
                  title="Use my current location"
                >
                  <LocateFixed size={16} style={{ color: ORANGE }} className={locating ? 'animate-spin' : ''} />
                </button>
              }
            >
              <input
                type="text"
                placeholder="Enter or Select Service Area"
                value={form.serviceArea}
                onChange={(e) => setForm({ ...form, serviceArea: e.target.value })}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </Field>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="relative mt-5">
            <OrangeButton
              onClick={() => {
                setNameTouched(true);
                setProfessionTouched(true);
                sendOtp(true);
              }}
              disabled={!validPhone || !form.name.trim() || !form.profession.trim() || (form.email.length > 0 && !validEmail)}
              loading={sending}
            >
              Sign Up
            </OrangeButton>
          </div>

          <p className="mt-3.5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
                setDebugCode(null);
                setNameTouched(false);
                setProfessionTouched(false);
              }}
              className="h-11 font-semibold underline-offset-2 active:opacity-70"
              style={{ color: ORANGE }}
            >
              Login
            </button>
          </p>

          <div className="mt-4 flex-1" />

          <p className="relative text-center text-xs leading-relaxed text-gray-400">
            By creating an account, you agree to our{' '}
            <span className="font-semibold text-gray-600">Terms</span> &{' '}
            <span className="font-semibold text-gray-600">Privacy Policy</span>
          </p>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col animate-[slideUp_0.4s_ease-out]">
          <BackBtn onClick={leaveOtpStep} />

          <div className="mb-7">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-gray-900">
              Verify your number
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-500">
              We've sent a 6-digit OTP to{' '}
              <span className="whitespace-nowrap font-bold text-gray-900">+91 {prettyPhone}</span>
            </p>
          </div>

          <DevOtpHint
            code={debugCode}
            onFill={() => {
              if (!debugCode) return;
              setDigits(debugCode.split(''));
              inputs.current[debugCode.length - 1]?.focus();
            }}
          />

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
                className={`h-14 w-full min-w-0 rounded-[16px] border-2 text-center text-xl font-extrabold text-gray-900 transition-all duration-150 focus:outline-none focus:ring-4 ${
                  error
                    ? 'border-red-400 bg-red-50/50 focus:ring-red-100'
                    : d
                      ? 'bg-white focus:border-[#FF6B00] focus:ring-[#FF6B00]/10'
                      : 'bg-[#FAFAFA] focus:border-[#FF6B00] focus:ring-[#FF6B00]/10'
                }`}
                style={{
                  borderColor: !error && d ? ORANGE : undefined,
                }}
              />
            ))}
          </div>
          {error && <p className="mt-3 text-center text-sm font-medium text-red-500">{error}</p>}

          <div className="mt-6 text-center text-sm text-gray-500">
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
                  onClick={() => sendOtp(step === 'signup-otp')}
                  disabled={sending}
                  className="font-semibold active:opacity-70 disabled:opacity-60"
                  style={{ color: ORANGE }}
                >
                  {sending ? 'Sending...' : 'Resend OTP'}
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
            onClick={leaveOtpStep}
            className="mx-auto flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800"
          >
            <Pencil size={13} /> Change mobile number
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

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
    className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[18px] text-[15px] font-semibold text-white transition-all duration-200 focus-visible:ring-4 focus-visible:ring-[#FF6B00]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    style={{
      background: disabled || loading ? '#FFC399' : 'linear-gradient(180deg, #FF7E24 0%, #FF6B00 100%)',
      boxShadow: disabled || loading ? 'none' : '0 12px 24px -8px rgba(255, 107, 0, 0.55)',
    }}
  >
    {loading ? (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    ) : (
      <>
        {children} <ArrowRight size={18} strokeWidth={2.4} />
      </>
    )}
  </button>
);

const Field = ({
  icon,
  label,
  children,
  error,
  errorText,
  hideLabel,
  compact,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  error?: boolean;
  errorText?: string;
  hideLabel?: boolean;
  compact?: boolean;
  right?: React.ReactNode;
}) => (
  <div>
    {!hideLabel && (
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[13px] font-semibold text-gray-700">{label}</label>
      </div>
    )}
    <div
      className={`flex items-center gap-3 rounded-[16px] border bg-[#FAFAFA] px-4 transition-all duration-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FF6B00]/10 ${
        compact ? 'h-12' : 'h-[54px]'
      } ${error ? 'border-red-400' : 'border-gray-200 focus-within:border-[#FF6B00]'}`}
    >
      <span className="shrink-0 text-gray-500">{icon}</span>
      {children}
      {right}
    </div>
    {errorText && <p className="mt-1.5 text-xs font-medium text-red-500">{errorText}</p>}
  </div>
);

const TrustFooter = () => (
  <div
    className="mt-1 flex items-start justify-between gap-1.5 rounded-[18px] border border-orange-100 px-2 py-3.5"
    style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFFBF7 100%)' }}
  >
    {[
      { Icon: Shield, label: 'Verified Jobs' },
      { Icon: Zap, label: 'Fast Payouts' },
      { Icon: Users, label: 'More Requests' },
      { Icon: Heart, label: 'Your Schedule' },
    ].map(({ Icon, label }) => (
      <div key={label} className="flex min-h-[44px] flex-1 flex-col items-center gap-1.5 px-1 text-center">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: '#FFE9DA' }}
        >
          <Icon size={15} strokeWidth={2.2} style={{ color: ORANGE }} />
        </span>
        <span className="text-[9px] font-semibold leading-tight text-gray-600">{label}</span>
      </div>
    ))}
  </div>
);

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="-ml-2 mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FAFAFA] text-gray-700 transition-colors hover:bg-gray-100"
    aria-label="Back"
  >
    <ArrowLeft size={20} />
  </button>
);

const ErrorNote = ({ children }: { children: React.ReactNode }) => (
  <p
    role="alert"
    className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-2.5 text-center text-[13px] font-medium leading-snug text-red-600"
  >
    {children}
  </p>
);
