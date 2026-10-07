import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Pencil,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { DevOtpHint } from '@/components/DevOtpHint';
import { useApp } from '@/context/app-context';
import { api, isSignupRequired, otpErrorMessage, setApiToken } from '@/services/api';
import { registerPush } from '@/services/push';
import { fetchCurrentLocation } from '@/services/location';

const GREEN = '#0f9d6e';
const GREEN_DARK = '#0b7f58';
const GREEN_SOFT = '#d1fae5';
const GREEN_LIGHT_DISABLED = '#a7f3d0';
const phoneRegex = /^[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNREGISTERED_FALLBACK = 'This number is not registered yet. Please sign up first.';

const PrimaryButton = ({
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
    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed"
    style={{
      background: disabled && !loading ? GREEN_LIGHT_DISABLED : GREEN,
    }}
    onMouseEnter={(e) => {
      if (!disabled && !loading) (e.target as HTMLElement).style.background = GREEN_DARK;
    }}
    onMouseLeave={(e) => {
      if (!disabled && !loading) (e.target as HTMLElement).style.background = GREEN;
    }}
  >
    {loading ? (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    ) : null}
    <span>{loading ? 'Sending OTP…' : children}</span>
  </button>
);

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
    aria-label="Back"
  >
    <ArrowLeft size={20} />
  </button>
);

const ErrorNote = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="mt-2 text-xs font-medium text-red-500">
    {children}
  </p>
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
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [locAttempted, setLocAttempted] = useState(false);

  const fieldError = (condition: boolean, text: string) =>
    condition ? (
      <p role="alert" className="mt-2 text-[13px] font-medium text-red-500">{text}</p>
    ) : null;

  const inputCls = (hasError: boolean) =>
    `w-full h-[52px] rounded-[10px] border bg-white px-4 text-[14px] font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all duration-200 ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
        : 'border-[#dfe5e2] focus:border-[#0f9d6e] focus:ring-4 focus:ring-emerald-500/15'
    }`;

  const phoneWrapperCls = (hasError: boolean) =>
    `flex h-[52px] rounded-[10px] border bg-white overflow-hidden transition-all duration-200 ${
      hasError
        ? 'border-red-500 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
        : 'border-[#dfe5e2] focus-within:border-[#0f9d6e] focus-within:ring-4 focus-within:ring-emerald-500/15'
    }`;

  const locationWrapperCls = (hasError: boolean) =>
    `flex h-[52px] items-center rounded-[10px] border bg-white px-3 gap-3 transition-all duration-200 ${
      hasError
        ? 'border-red-500 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
        : 'border-[#dfe5e2] focus-within:border-[#0f9d6e] focus-within:ring-4 focus-within:ring-emerald-500/15'
    }`;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const validPhone = phoneRegex.test(phone);
  const validEmail = emailRegex.test(email.trim());

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
      const res = await api.auth.requestOtp({
        phone,
        role: 'customer',
        mode: isSignup ? 'signup' : 'login',
      });
      setDebugCode(res.debug_code || null);
      setDigits(Array(6).fill(''));
      setTimer(res.resend_after || 30);
      setStep(isSignup ? 'signup-otp' : 'otp');
    } catch (e) {
      if (!isSignup && isSignupRequired(e)) {
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

  const code = digits.join('');

  const verifyOtp = async () => {
    if (code.length !== 6 || verifying) return;
    setError('');
    setVerifying(true);
    const isSignup = step === 'signup-otp';
    try {
      const res = await api.auth.verifyOtp({
        phone,
        code,
        role: 'customer',
        mode: isSignup ? 'signup' : 'login',
        name: isSignup ? name.trim() : undefined,
        email: isSignup ? email.trim() || undefined : undefined,
        location: isSignup ? location || undefined : undefined,
      });
      setApiToken(res.access_token);
      const profile = res.profile;
      setCustomer({
        name: profile?.name || name.trim(),
        phone: profile?.phone || phone,
        email: profile?.email || email || '',
        location: profile?.location || location || '',
      });
      registerPush((body) => api.customer.deviceToken(body.token, body.platform));
      navigate({ name: 'home' });
    } catch (e) {
      if (!isSignup && isSignupRequired(e)) {
        setStep('signup');
        setError(otpErrorMessage(e, UNREGISTERED_FALLBACK));
        return;
      }
      setError(otpErrorMessage(e, 'Incorrect OTP. Please try again.'));
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const prettyPhone = phone.replace(/^(\d{5})(\d{5})$/, '$1 $2');
  const badPhone = phone.length > 0 && !validPhone;

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 md:flex-col md:justify-between bg-[#0b1512] p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Logo size={48} className="rounded-xl" />
          <p className="text-xl font-extrabold tracking-tight text-white">
            Lucky<span style={{ color: GREEN }}>Seva</span>
          </p>
        </div>

        {/* Center copy */}
        <div className="space-y-6">
          <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight text-white">
            Home services you can trust, at your doorstep.
          </h1>
          <p className="text-base text-gray-400 leading-relaxed">
            Verified professionals, upfront pricing and reliable service, every time.
          </p>
        </div>

        {/* Trust points */}
        <div className="space-y-4">
          {[
            'Background-verified professionals',
            'Transparent pricing, no surprises',
            'Support when you need it',
          ].map((text) => (
            <div key={text} className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: GREEN_SOFT }}
              >
                <Check size={13} strokeWidth={2.5} style={{ color: GREEN }} />
              </span>
              <span className="text-sm font-medium text-gray-300">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-12">
          <div className="w-full max-w-[400px]">

            {/* Mobile slim dark top bar — only on phone step */}
            {step === 'phone' && (
              <div className="mb-8 flex md:hidden items-center justify-center bg-[#0b1512] -mx-6 -mt-4 px-6 py-4">
                <Logo size={40} className="rounded-xl" />
              </div>
            )}

            {/* Signup step */}
            {step === 'signup' && (
              <div className="flex flex-col">
                <h2 className="text-[30px] font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.02em' }}>
                  Create account
                </h2>
                <p className="mt-2 text-[15px] text-gray-500">
                  Sign up to get started with LuckySeva.
                </p>

                <div className="mt-8 flex flex-col gap-5">

                  {/* Full Name */}
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onBlur={() => setNameTouched(true)}
                    onChange={(e) => setName(e.target.value)}
                    aria-label="Full Name"
                    aria-invalid={!name.trim() && nameTouched ? 'true' : 'false'}
                    className={inputCls(!name.trim() && nameTouched)}
                  />
                  {fieldError(!name.trim() && nameTouched, 'Enter your full name')}

                  {/* Email Address */}
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="Email Address"
                    value={email}
                    onBlur={() => setEmailTouched(true)}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email Address"
                    aria-invalid={email.length > 0 && !validEmail && emailTouched ? 'true' : 'false'}
                    className={inputCls(email.length > 0 && !validEmail && emailTouched)}
                  />
                  {fieldError(email.length > 0 && !validEmail && emailTouched, 'Enter a valid email address')}

                  {/* Mobile Number */}
                  <div className={phoneWrapperCls(badPhone && phoneTouched)}>
                    <span className="flex h-full shrink-0 items-center border-r border-[#dfe5e2] px-4 text-[14px] font-semibold text-gray-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Mobile Number"
                      value={phone}
                      onBlur={() => setPhoneTouched(true)}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      aria-label="Mobile Number"
                      aria-invalid={badPhone && phoneTouched ? 'true' : 'false'}
                      className="h-full min-w-0 flex-1 bg-transparent px-4 text-[14px] font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  {fieldError(badPhone && phoneTouched, 'Enter a valid 10-digit mobile number')}

                  {/* Location */}
                  <div className={locationWrapperCls(locError && locAttempted)}>
                    <input
                      type="text"
                      placeholder="Location"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setLocError('');
                        setLocAttempted(false);
                      }}
                      aria-label="Location"
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setLocAttempted(true);
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
                      title="Use current location"
                      aria-label="Detect my location"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ backgroundColor: '#d1fae5' }}
                    >
                      {locating ? (
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldError(locError && locAttempted, locError)}

                </div>

                {error && <ErrorNote>{error}</ErrorNote>}

                <div className="mt-6">
                  <PrimaryButton
                    onClick={() => sendOtp(true)}
                    disabled={!validPhone || !name.trim() || (email.length > 0 && !validEmail)}
                    loading={sending}
                  >
                    Get OTP
                  </PrimaryButton>
                </div>

                <p className="mt-6 text-center text-[14px] text-gray-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setError('');
                      setDebugCode(null);
                      setNameTouched(false);
                      setEmailTouched(false);
                      setPhoneTouched(false);
                    }}
                    className="font-bold"
                    style={{ color: GREEN }}
                  >
                    Log in
                  </button>
                </p>

                <p className="mt-6 text-center text-[12.5px] leading-relaxed text-gray-400">
                  By creating an account, you agree to our{' '}
                  <a href="#" className="font-normal" style={{ color: GREEN, textDecoration: 'underline' }}>Terms of Service</a> and{' '}
                  <a href="#" className="font-normal" style={{ color: GREEN, textDecoration: 'underline' }}>Privacy Policy</a>.
                </p>
              </div>
            )}

            {/* Phone step */}
            {step === 'phone' && (
              <div className="flex flex-col">
                <h2 className="text-[30px] font-bold tracking-tight text-gray-900">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Log in with your mobile number to continue.
                </p>

                <div className="mt-8">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Mobile number
                  </label>
                  <div
                    className={`flex h-[52px] items-center gap-0 rounded-[10px] border bg-white transition-all duration-200 focus-within:border-[${GREEN}] focus-within:ring-4 focus-within:ring-emerald-500/20 ${
                      badPhone ? 'border-red-400' : 'border-[#dfe5e2]'
                    }`}
                    style={
                      badPhone
                        ? {}
                        : {
                            '--tw-ring-color': 'rgba(15, 157, 110, 0.2)',
                          } as React.CSSProperties
                    }
                  >
                    <span className="flex h-full shrink-0 items-center gap-2 border-r border-[#dfe5e2] px-4 text-sm font-semibold text-gray-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Enter mobile number"
                      autoFocus
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      aria-label="Mobile number"
                      aria-describedby={badPhone ? 'phone-error' : undefined}
                      className="h-full min-w-0 flex-1 px-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  {badPhone && (
                    <p id="phone-error" className="mt-2 text-xs font-medium text-red-500" role="alert">
                      Enter a valid 10-digit mobile number
                    </p>
                  )}
                </div>

                {error && (
                  <ErrorNote>{error}</ErrorNote>
                )}

                <div className="mt-6">
                  <PrimaryButton
                    onClick={() => sendOtp(false)}
                    disabled={!validPhone}
                    loading={sending}
                  >
                    Get OTP
                  </PrimaryButton>
                </div>

                <p className="mt-6 text-sm text-gray-500 text-center">
                  New to LuckySeva?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setStep('signup');
                      setError('');
                    }}
                    className="font-bold"
                    style={{ color: GREEN }}
                  >
                    Create an account
                  </button>
                </p>

                <p className="mt-6 text-center leading-relaxed" style={{ fontSize: '12.5px', color: '#9ca3af', lineHeight: 1.6 }}>
                  By continuing, you agree to our{' '}
                  <a href="#" style={{ color: GREEN, textDecoration: 'underline', fontWeight: 'normal' }}>Terms of Service</a> and{' '}
                  <a href="#" style={{ color: GREEN, textDecoration: 'underline', fontWeight: 'normal' }}>Privacy Policy</a>.
                </p>
              </div>
            )}

            {/* OTP step */}
            {(step === 'otp' || step === 'signup-otp') && (
              <div className="flex flex-col">
                <BackBtn onClick={leaveOtpStep} />

                <h2 className="text-[30px] font-bold tracking-tight text-gray-900">
                  Verify your number
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  We've sent a 6-digit OTP to{' '}
                  <span className="whitespace-nowrap font-semibold text-gray-900">
                    +91 {prettyPhone}
                  </span>
                </p>

                <DevOtpHint
                  code={debugCode}
                  onFill={() => {
                    if (!debugCode) return;
                    setDigits(debugCode.split(''));
                    inputs.current[debugCode.length - 1]?.focus();
                  }}
                />

                <div className="mt-8 grid grid-cols-6 gap-2">
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
                      className={`h-14 w-full min-w-0 rounded-[10px] border-2 text-center text-xl font-bold text-gray-900 transition-all duration-150 focus:outline-none focus:ring-4 ${
                        error
                          ? 'border-red-400 bg-red-50/50 focus:ring-red-100'
                          : d
                            ? 'border-[#0f9d6e] bg-white focus:ring-emerald-500/20'
                            : 'border-[#dfe5e2] bg-[#FAFAFA] focus:border-[#0f9d6e] focus:ring-emerald-500/20'
                      }`}
                    />
                  ))}
                </div>
                {error && (
                  <p className="mt-3 text-sm font-medium text-red-500" role="alert">
                    {error}
                  </p>
                )}

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
                        className="font-semibold disabled:opacity-60"
                        style={{ color: GREEN }}
                      >
                        {sending ? 'Sending…' : 'Resend OTP'}
                      </button>
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <PrimaryButton onClick={verifyOtp} disabled={code.length !== 6} loading={verifying}>
                    Verify & Continue
                  </PrimaryButton>
                </div>

                <button
                  type="button"
                  onClick={leaveOtpStep}
                  className="mx-auto mt-6 flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
                >
                  <Pencil size={13} /> Change mobile number
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
