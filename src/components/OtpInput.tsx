import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, PhoneCall, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui';

export const OtpSection = ({
  phone,
  onVerify,
  onBack,
}: {
  phone: string;
  onVerify: (code: string) => void;
  onBack: () => void;
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

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

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const complete = digits.every((d) => d !== '');
  const formattedPhone = phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1 $2 $3');

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <PhoneCall size={24} />
        </div>
        <p className="text-center text-sm text-gray-500">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-gray-900">+91 {formattedPhone || phone}</span>
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-label={`OTP digit ${i + 1}`}
            className={`h-16 w-14 rounded-2xl border-2 bg-gray-50 text-center text-2xl font-extrabold text-gray-900 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
              d ? 'border-emerald-500 bg-white' : 'border-gray-200 focus:border-emerald-500'
            }`}
          />
        ))}
      </div>

      <div className="text-center text-sm text-gray-500">
        {timer > 0 ? (
          <p>
            Didn't receive the code?{' '}
            <span className="font-semibold text-gray-400">
              Resend in 0:{String(timer).padStart(2, '0')}
            </span>
          </p>
        ) : (
          <button
            onClick={() => {
              setTimer(60);
              setDigits(['', '', '', '', '', '']);
              inputs.current[0]?.focus();
            }}
            className="font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Resend OTP
          </button>
        )}
      </div>

      <Button onClick={() => onVerify(digits.join(''))} disabled={!complete} className="w-full">
        <ShieldCheck size={18} /> Verify & Continue
      </Button>

      <button
        onClick={onBack}
        className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
      >
        <Edit3 size={14} /> Change phone number
      </button>
    </div>
  );
};