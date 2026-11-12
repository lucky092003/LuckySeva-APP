import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Briefcase,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Headphones,
  IndianRupee,
  LockKeyhole,
  Mail,
  MapPin,
  PhoneCall,
  Quote,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  UserCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useApp } from '@/context/app-context';
import { CUSTOMER_SITE_URL } from '@/config/site-links';

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
// The partner site shares the customer site's light canvas: ivory paper,
// slate ink, emerald for actions. The sections are numbered like a corporate
// brochure with smooth hierarchy and generous spacing.

const SUPPORT_PHONE = '1800-200-9876';
const SUPPORT_EMAIL = 'partners@luckyseva.com';

const inr = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value))}`;

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
const BENEFITS: { icon: typeof Sparkles; title: string; body: string }[] = [
  {
    icon: MapPin,
    title: 'Jobs that fit your trade',
    body: 'Requests are matched to your skills, service radius and availability — not offered to whoever taps first.',
  },
  {
    icon: IndianRupee,
    title: 'The price, before you accept',
    body: 'Job value, platform fee and your payout are shown up front. No deduction is ever a surprise.',
  },
  {
    icon: Banknote,
    title: 'Paid every Monday',
    body: 'Online payments settle weekly to your bank or UPI, with a statement you can download.',
  },
  {
    icon: Clock,
    title: 'Your hours, your call',
    body: 'Go online when it suits you. Take a day off without losing your standing or your rating.',
  },
  {
    icon: TrendingUp,
    title: 'Repeat customers',
    body: 'Strong ratings turn a single visit into regular work from the same household.',
  },
  {
    icon: Headphones,
    title: 'A desk that answers',
    body: 'Disputes, cancellations and payout questions handled by a real partner support team.',
  },
];

const STEPS: { title: string; body: string; duration: string }[] = [
  {
    title: 'Apply with your mobile',
    body: 'Verify your number, add your trade and the area you can cover.',
    duration: '5 minutes',
  },
  {
    title: 'Get verified',
    body: 'Upload a government ID and proof of your trade. We check both.',
    duration: '24–48 hours',
  },
  {
    title: 'Switch on',
    body: 'Accept requests that fit your skills, distance and timing.',
    duration: 'Same day',
  },
  {
    title: 'Get paid',
    body: 'Weekly settlement to your bank or UPI, with a full statement.',
    duration: 'Every Monday',
  },
];

const REQUIREMENTS = [
  'A government photo ID — Aadhaar, PAN or driving licence',
  'Proof of your trade — certificate, licence or work experience',
  'A bank account or UPI ID in your own name',
  'Your service area and how far you can travel',
  'A smartphone with the LuckySeva Partner app',
];

const TESTIMONIALS = [
  {
    quote:
      'Earlier I depended on one building for work. Now I get three or four jobs a week from my own area, and the payout is in my account every Monday.',
    name: 'Suresh P.',
    trade: 'Electrician · Pune',
    earning: '₹46,200',
    note: 'last month',
  },
  {
    quote:
      'The app tells me the amount before I accept. That is the part I trust — no argument about the price after the work is done.',
    name: 'Imran S.',
    trade: 'AC technician · Hyderabad',
    earning: '₹52,800',
    note: 'last month',
  },
  {
    quote:
      'I work mornings only because of my children. I go online after 9, take two jobs, and log off. No one forces a full day.',
    name: 'Meena K.',
    trade: 'Home cleaning · Delhi NCR',
    earning: '₹28,400',
    note: 'last month',
  },
];

const FAQS = [
  {
    q: 'Is there any joining fee?',
    a: 'None. Onboarding is free and there is no monthly subscription. LuckySeva only charges a per-job platform fee, shown before you accept a request.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Online payments are settled to your bank account or UPI ID every week, with a statement you can download. Cash jobs are recorded in the app and adjusted in the same cycle.',
  },
  {
    q: 'Do I need my own tools?',
    a: 'Yes — you bring the tools of your trade. LuckySeva provides the partner badge, the app and the customer relationship. Consumables are agreed with the customer before the job.',
  },
  {
    q: 'Can I choose which jobs I accept?',
    a: 'Always. Requests are offered to you and you decide. Repeated declines simply reduce offers for that slot; they do not penalise your account.',
  },
  {
    q: 'Which trades do you onboard?',
    a: 'Electricians, plumbers, AC technicians, cleaners, carpenters, painters, appliance technicians, salon professionals, pest control, physiotherapy, packers, CCTV technicians, laundry and gardening experts.',
  },
];

const JOB_FEED = [
  {
    icon: Snowflake,
    title: 'AC service & cleaning',
    meta: '2.4 km away · Today, 4:00 PM',
    value: '₹1,200',
  },
  {
    icon: Zap,
    title: 'Switchboard repair',
    meta: '1.1 km away · Today, 6:30 PM',
    value: '₹650',
  },
  {
    icon: Sparkles,
    title: 'Kitchen deep clean',
    meta: '3.8 km away · Tomorrow, 10:00 AM',
    value: '₹2,400',
  },
];

// Local, bundled photos (src/assets/services/<trade>.jpg) shared with the
// customer site, so the trade cards never break when a host changes.
const SERVICE_PHOTOS = import.meta.glob('@/assets/services/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const serviceImage = (slug: string) => {
  const key = Object.keys(SERVICE_PHOTOS).find((path) => path.endsWith(`/${slug}.jpg`));
  return key ? SERVICE_PHOTOS[key] : undefined;
};

const CITY_STRIPS = ['Pune', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Jaipur', 'Ahmedabad'];

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */
const SectionLabel = ({ index, children }: { index: string; children: ReactNode }) => (
  <div className="flex items-center gap-3">
    <span className="text-[12px] font-bold tracking-[0.18em] text-[#059669]">{index}</span>
    <span aria-hidden className="h-px w-7 bg-[#CBD5E1]" />
    <span className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#475569]">
      {children}
    </span>
  </div>
);

const Micro = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${className}`}>
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/* Smooth-scroll helper                                                */
/* ------------------------------------------------------------------ */
const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ------------------------------------------------------------------ */
/* Partner login card                                                  */
/* ------------------------------------------------------------------ */
type FeedJob = { icon: typeof Snowflake; title: string; meta: string; value: string };

const LoginCard = ({ jobFeed, loadingFeed }: { jobFeed: FeedJob[]; loadingFeed: boolean }) => {
  const { navigate } = useApp();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const valid = /^[6-9]\d{9}$/.test(phone);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setTouched(true);
      return;
    }
    navigate({ name: 'provider-auth', phone });
  };

  return (
    <div className="relative w-full">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[36px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(5,150,105,0.16),transparent_70%)]"
      />

      {/* Floating glass badges — selling points orbiting the card */}
      <div
        className="landing-float absolute -left-8 top-16 z-10 hidden items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md xl:flex"
        style={{ animationDelay: '0.8s' }}
      >
        <Banknote size={14} className="text-[#059669]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#334155]">
          Weekly payout
        </span>
      </div>
      <div
        className="landing-float-slow absolute -right-6 bottom-44 z-10 hidden items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md xl:flex"
        style={{ animationDelay: '1.6s' }}
      >
        <Star size={14} className="fill-[#F97316] text-[#F97316]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#334155]">
          4.8 partner rating
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-[0_36px_80px_-42px_rgba(15,23,42,0.55)] ring-1 ring-[#0F172A]/5 transition duration-300 hover:ring-[#059669]/25">
        <div aria-hidden className="h-1.5 rounded-full bg-[linear-gradient(90deg,#059669_0%,#F97316_45%,#059669_100%)]" />
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-center gap-3">
            <Logo size={40} className="rounded-xl shadow-sm ring-1 ring-[#0F172A]/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                Partner account
              </p>
            </div>
            <span className="rounded-full border border-[#B7E5C8] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#047857]">
              Sign in
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#059669]" />
              <Micro className="text-[#94A3B8]">Partner sign in</Micro>
            </div>
            <h2 className="mt-2 font-customer-display text-[30px] leading-[1.02] tracking-[-0.01em] text-[#0F172A]">
              Your jobs are waiting.
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-5 text-[#64748B]">
              Sign in with your registered mobile number to see requests and earnings.
            </p>
          </div>

          <form onSubmit={submit} className="mt-5">
            <label
              htmlFor="partner-landing-phone"
              className="text-[13.5px] font-bold text-[#334155]"
            >
              Mobile number
            </label>
            <div
              className={`mt-2 flex h-[52px] items-center gap-3 rounded-xl border bg-[#FFFFFF] px-4 transition focus-within:bg-white focus-within:ring-4 focus-within:ring-[#059669]/10 ${
                touched && !valid
                  ? 'border-[#DC2626] focus-within:border-[#DC2626]'
                  : 'border-[#E2E8F0] focus-within:border-[#059669]'
              }`}
            >
              <span className="flex shrink-0 items-center gap-1.5 text-[16px] font-bold text-[#0F172A]">
                +91
                <span className="h-4 w-px bg-[#CBD5E1]" />
              </span>
              <input
                id="partner-landing-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="Enter mobile number"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !valid}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium tracking-wide text-[#0F172A] outline-none placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#94A3B8]"
              />
            </div>
            {touched && !valid && (
              <p className="mt-1.5 text-[13px] font-semibold text-[#DC2626]">
                Enter a valid 10-digit Indian mobile number.
              </p>
            )}

            <button
              type="submit"
              disabled={!valid}
              className="landing-sweep relative mt-4 flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#059669] text-[15px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(5,150,105,0.85)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Continue with OTP
              <ArrowRight size={17} strokeWidth={2.5} />
            </button>

            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#94A3B8]">
                <LockKeyhole size={11} /> Secure OTP sign-in
              </span>
            </div>
          </form>

          <p className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-[12px] leading-5 text-[#64748B]">
            New professional? Continue with the same number — if it is not registered yet, we
            open the partner application.
          </p>

          <p className="mt-4 border-t border-[#E2E8F0] pt-3.5 text-center text-[11.5px] leading-4 text-[#9A8B7A]">
            By continuing you agree to the LuckySeva Partner Terms and Privacy Policy.
          </p>
        </div>

        {/* Live request preview — shows the product, not just a form. */}
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 pb-4 pt-3.5 sm:px-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#059669]" />
              <Micro className="text-[#94A3B8]">Requests near you</Micro>
            </span>
            <Micro className="text-[#94A3B8]">Preview</Micro>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {loadingFeed ? (
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-[#F1F5F9] bg-[#FFFFFF] px-2.5 py-2"
                >
                  <span className="landing-pulse-dot h-7 w-7 shrink-0 rounded-md bg-[#E2E8F0]" />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span
                      className="block h-2.5 rounded-full bg-[#E2E8F0]"
                      style={{ width: `${64 - i * 8}%` }}
                    />
                    <span className="block h-2 w-2/5 rounded-full bg-[#EEF2F6]" />
                  </span>
                  <span className="h-2.5 w-9 shrink-0 rounded-full bg-[#059669]/20" />
                </div>
              ))
            ) : jobFeed.length === 0 ? (
              <p className="text-xs text-[#64748B]">No active requests</p>
            ) : (
              jobFeed.map((job) => (
                <div
                  key={job.title}
                  className="flex items-center gap-2.5 rounded-lg border border-[#F1F5F9] bg-[#FFFFFF] px-2.5 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#ECFDF5] text-[#059669]">
                    {job.icon && <job.icon size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-[#0F172A]">
                      {job.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-[#64748B]">
                      {job.meta}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-bold text-[#059669]">
                    {job.value}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Earnings calculator                                                 */
/* ------------------------------------------------------------------ */
const EarningsCalculator = () => {
  const [jobsPerWeek, setJobsPerWeek] = useState(15);
  const [avgValue, setAvgValue] = useState(800);

  const weeks = 4.33;
  const feeRate = 0.15;
  const gross = jobsPerWeek * avgValue * weeks;
  const fee = gross * feeRate;
  const net = gross - fee;
  const weekly = net / weeks;
  const pct = ((jobsPerWeek - 5) / (35 - 5)) * 100;

  const weekBars = [0.62, 0.88, 0.74, 1];
  const maxBar = Math.max(...weekBars);
  const weekValues = weekBars.map((bar) => weekly * bar);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr]">
      {/* Controls */}
      <div className="flex flex-col rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_36px_80px_-48px_rgba(15,23,42,0.35)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#94A3B8]">Jobs per week</Micro>
            <p className="mt-1.5 font-customer-display text-[36px] leading-none tracking-[-0.01em] text-[#0F172A]">
              {jobsPerWeek}
              <span className="ml-2 font-sans text-[13px] font-medium text-[#94A3B8]">jobs</span>
            </p>
          </div>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
            Adjust
          </span>
        </div>

        <input
          type="range"
          min={5}
          max={35}
          step={1}
          value={jobsPerWeek}
          onChange={(event) => setJobsPerWeek(Number(event.target.value))}
          aria-label="Jobs per week"
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/40 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#FFFFFF] [&::-moz-range-thumb]:bg-[#059669] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(5,150,105,0.18)] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#FFFFFF] [&::-webkit-slider-thumb]:bg-[#059669] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(5,150,105,0.18)]"
          style={{
            background: `linear-gradient(to right, #059669 0%, #059669 ${pct}%, rgba(15,23,42,0.08) ${pct}%, rgba(15,23,42,0.08) 100%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
          <span>5</span>
          <span>35</span>
        </div>

        <div className="mt-6">
          <Micro className="text-[#94A3B8]">Average job value</Micro>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { value: 500, label: '₹500' },
              { value: 800, label: '₹800' },
              { value: 1200, label: '₹1,200' },
            ].map((option) => {
              const active = avgValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAvgValue(option.value)}
                  aria-pressed={active}
                  className={`h-10 rounded-lg border text-[13px] font-bold transition ${
                    active
                      ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[#B7E5C8] bg-[linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.02))] p-4">
          <Micro className="text-[#047857]">Estimated take-home</Micro>
          <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-customer-display text-[44px] leading-none tracking-[-0.02em] text-[#047857]">
              {inr(net)}
            </p>
            <span className="pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
              per month
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#334155]">
            <Wallet size={12} className="text-[#059669]" />
            About {inr(weekly)} paid out every Monday
          </p>
        </div>

        <p className="mt-auto pt-4 text-[11.5px] leading-5 text-[#64748B]">
          Illustration only, using a 15% per-job platform fee. Actual earnings depend on your
          trade, city, availability and the jobs you accept.
        </p>
      </div>

      {/* Payout preview */}
      <div className="flex flex-col overflow-hidden rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_36px_80px_-48px_rgba(15,23,42,0.35)] sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#059669]/20 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#64748B]">Payout preview</Micro>
            <p className="mt-2 font-customer-display text-[22px] leading-tight tracking-[-0.01em] text-[#F8FAFC]">
              What lands in your account
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-[#059669]/40 bg-[#059669]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#059669]">
            <CalendarCheck size={10} /> Weekly
          </span>
        </div>

        <div className="relative mt-7 flex h-[132px] items-end gap-2.5">
          {weekBars.map((bar, index) => (
            <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-[0.02em] text-[#94A3B8]">
                {inr(weekValues[index])}
              </span>
              <div
                className={`w-full rounded-t-[4px] transition-all duration-300 ${
                  index === 3 ? 'bg-[#34D399]' : 'bg-[#34D399]/25'
                }`}
                style={{ height: `${Math.max(10, (bar / maxBar) * 72)}px` }}
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B]">
                W{index + 1}
              </span>
            </div>
          ))}
        </div>

        <dl className="relative mt-6 space-y-0 border-t border-white/10 text-[13.5px]">
          {[
            { label: 'Gross this month', value: inr(gross) },
            { label: 'Platform fee · 15%', value: `−${inr(fee)}` },
            { label: 'You keep', value: inr(net), strong: true },
            { label: 'Next payout · Monday', value: inr(weekly), payout: true },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-white/[0.07] py-3 last:border-b-0"
            >
              <dt
                className={
                  row.strong ? 'font-bold text-[#059669]' : 'text-[#94A3B8]'
                }
              >
                {row.label}
              </dt>
              <dd
                className={
                  row.strong
                    ? 'font-customer-display text-[24px] font-normal italic text-[#6EE7B7]'
                    : row.payout
                      ? 'font-mono text-[13px] font-bold text-[#F8FAFC]'
                      : 'font-mono text-[13px] font-semibold text-[#CBD5E1]'
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-auto space-y-2 pt-5">
          {[
            { icon: Banknote, label: 'Bank transfer · IMPS' },
            { icon: Smartphone, label: 'UPI · same-day after settlement' },
            { icon: ShieldCheck, label: 'Statement for every payout' },
          ].map((item) => (
            <p key={item.label} className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
              <item.icon size={12} className="text-[#059669]" />
              {item.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export const ProviderLandingScreen = () => {
  const { navigate } = useApp();

  const goToLogin = () => navigate({ name: 'provider-auth' });

  // This card is shown to signed-out visitors, so there is no "my bookings"
  // to fetch yet — it is an illustrative preview of the kind of requests a
  // partner sees, not a live feed for this browser.
  const jobFeed = JOB_FEED;
  const loadingFeed = false;

  const navItems = [
    { label: 'Trades', id: 'trades' },
    { label: 'Earnings', id: 'earnings' },
    { label: 'Why partner', id: 'benefits' },
    { label: 'How it works', id: 'how-it-works' },
    ...(FAQS.length > 0 ? [{ label: 'FAQs', id: 'faqs' }] : []),
  ];

  const marqueeItems = [
    'AC service · ₹1,200',
    'Deep cleaning · ₹2,400',
    'Switchboard repair · ₹650',
    'Plumbing · ₹900',
    'Carpentry · ₹1,800',
    'Appliance repair · ₹1,100',
    'Salon at home · ₹1,500',
    'Pest control · ₹2,100',
  ];

  const TRADES: { slug: string; name: string }[] = [
    { slug: 'electrician', name: 'Electrician' },
    { slug: 'plumber', name: 'Plumber' },
    { slug: 'ac-repair', name: 'AC Technician' },
    { slug: 'cleaning', name: 'Home Cleaning' },
    { slug: 'carpenter', name: 'Carpenter' },
    { slug: 'painting', name: 'Painter' },
    { slug: 'appliance-repair', name: 'Appliance Expert' },
    { slug: 'beauty-salon', name: 'Salon Professional' },
    { slug: 'pest-control', name: 'Pest Control' },
    { slug: 'physiotherapy', name: 'Physiotherapist' },
    { slug: 'packer-mover', name: 'Packers & Movers' },
    { slug: 'cctv-security', name: 'CCTV Technician' },
    { slug: 'laundry-dry-cleaning', name: 'Laundry Expert' },
    { slug: 'lawn-garden', name: 'Gardener' },
    { slug: 'other', name: 'Tell us your trade' },
  ];

  return (
    <div
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#FFFFFF] text-[#0F172A]"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0]/80 bg-[#FFFFFF]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-6 px-5 sm:px-8">
          <button
            type="button"
            onClick={() => scrollToId('top')}
            className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            aria-label="LuckySeva Partner home"
          >
            <Logo size={38} className="rounded-xl shadow-sm ring-1 ring-[#0F172A]/10" />
            <span className="text-left">
              <span className="block text-[18px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
                For professionals
              </span>
            </span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToId(item.id)}
                className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goToLogin}
              className="hidden h-10 items-center rounded-full border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-[14px] font-bold text-[#334155] transition hover:border-[#059669] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] sm:flex"
            >
              Partner login
            </button>
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-10 items-center gap-2 rounded-full bg-[#FFFFFF] px-4 text-[14px] font-bold text-[#0F172A] transition hover:-translate-y-0.5 hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            >
              Become a partner
              <ArrowUpRight size={14} strokeWidth={2.5} className="text-[#059669]" />
            </button>
          </div>
        </div>
      </header>

      <div id="top" />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-[#FFFFFF]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(52% 46% at 82% 8%, rgba(5,150,105,0.15) 0%, transparent 65%), radial-gradient(46% 50% at 4% 22%, rgba(249,115,22,0.10) 0%, transparent 62%)',
          }}
        />
        <div className="relative mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-12 px-4 pb-12 pt-10 sm:px-8 sm:pb-14 sm:pt-12 2xl:pb-28 2xl:pt-24 lg:grid-cols-[minmax(0,1.06fr)_minmax(360px,404px)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(400px,440px)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div className="landing-rise min-w-0">
            <div className="flex items-center gap-3">
              <span className="h-px w-9 bg-[#34D399]" />
              <span className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
                The LuckySeva partner programme
              </span>
            </div>

            <h1 className="mt-6 font-customer-display text-[54px] leading-[0.94] tracking-[-0.025em] text-[#0F172A] sm:text-[72px] xl:text-[80px] 2xl:text-[96px]">
              Your skill.
              <br />
              Your hours.
              <br />
              <span className="relative inline-block italic text-[#059669]">
                Your earnings.
                <svg
                  aria-hidden
                  viewBox="0 0 220 16"
                  fill="none"
                  className="absolute -bottom-1 left-0 h-3 w-full text-[#F97316]/70"
                >
                  <path
                    d="M3 11C48 4 140 2 217 8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="landing-draw"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-7 max-w-[520px] text-[17px] leading-8 text-[#334155]">
              Join the professionals behind LuckySeva. Get matched to jobs in your area, set
              your own hours and see every rupee before you accept — with weekly payouts and a
              team that backs you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={goToLogin}
                className="landing-sweep group relative flex h-[54px] items-center justify-center gap-2 overflow-hidden rounded-full bg-[#059669] px-7 text-[15px] font-bold text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20"
              >
                Start your application
                <ArrowRight size={17} strokeWidth={2.5} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('earnings')}
                className="group flex h-[54px] items-center justify-center gap-2 rounded-full border border-[#334155] bg-[#F8FAFC]/70 px-6 text-[15px] font-bold text-[#0F172A] backdrop-blur-sm transition hover:border-[#34D399] hover:bg-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
              >
                Estimate earnings
                <ChevronRight size={16} className="text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#059669]" />
              </button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
              {['No joining fee', 'Weekly payouts', 'Fee shown before you accept'].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-[#CBD5E1]"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
                    <Check size={9} strokeWidth={3.5} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            className="landing-rise relative w-full max-w-[404px] 2xl:max-w-[440px] justify-self-center lg:justify-self-end"
            style={{ animationDelay: '120ms' }}
          >
            <LoginCard jobFeed={jobFeed} loadingFeed={loadingFeed} />
          </div>
        </div>

        {/* Cities strip */}
        <div
          className="overflow-hidden border-y border-[#E2E8F0] bg-[#F8FAFC] py-4"
          style={{
            maskImage:
              'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
          }}
        >
          <div className="landing-marquee flex w-max items-center gap-10 whitespace-nowrap">
            {[...CITY_STRIPS, ...CITY_STRIPS, ...CITY_STRIPS, ...CITY_STRIPS].map((city, index) => (
              <span
                key={index}
                className="flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#64748B]"
              >
                <span className="h-1 w-1 rounded-full bg-[#059669]" />
                {city}
              </span>
            ))}
          </div>
        </div>

        {/* Live numbers band */}
        <div className="relative border-t border-[#E2E8F0] bg-[#FFFFFF]">
          <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8">
            {[
              { value: '18,400+', label: 'Partners in the network' },
              { value: '48 hrs', label: 'Average verification' },
              { value: '4.8/5', label: 'Partner rating' },
              { value: 'Every Monday', label: 'Payout commitment' },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`px-1 py-5 sm:px-6 sm:py-6 ${index > 0 ? 'sm:border-l sm:border-[#E2E8F0]' : ''}`}
              >
                <p className="font-customer-display text-[28px] leading-none tracking-tight text-[#0F172A] sm:text-[34px]">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748B]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Job ticker                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="overflow-hidden border-b border-[#E2E8F0] bg-[#FFFFFF] py-4"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        }}
      >
        <div className="landing-marquee flex w-max items-center gap-8 whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span
              key={index}
              className="flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]"
            >
              <span className="h-1 w-1 rounded-full bg-[#F97316]" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Trades                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section id="trades" className="scroll-mt-[74px] relative overflow-hidden bg-[#FFFFFF] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(rgba(15,23,42,0.06) 0.7px, transparent 0.7px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[640px]">
              <SectionLabel index="01">The network</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[52px]">
                Fifteen trades,
                <br className="hidden sm:block" /> one professional network.
              </h2>
            </div>
            <p className="max-w-[360px] text-[15px] leading-7 text-[#64748B]">
              Every trade above is verified once and backed across India. Whichever your
              skill, the badge carries the same weight to the customer — and the same
              standard of support for you.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TRADES.map((trade) => (
              <button
                key={trade.slug}
                type="button"
                onClick={goToLogin}
                className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl bg-[#FFFFFF] p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.35)] ring-1 ring-[#0F172A]/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-24px_rgba(15,23,42,0.45)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] sm:min-h-[240px] 2xl:min-h-[280px] sm:p-6 ${
                  trade.slug === 'other' ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : ''
                }`}
              >
                <div aria-hidden="true" className="absolute inset-0">
                  <img
                    src={serviceImage(trade.slug)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/90 via-[#0F172A]/15 to-transparent" />
                  <div
                    className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                    style={{ backgroundColor: '#34D399' }}
                  />
                </div>
                <div className="relative z-10 mt-auto flex items-end justify-between gap-3">
                  <span className="block text-[18px] font-extrabold leading-tight tracking-tight text-white">
                    {trade.name}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition group-hover:border-[#34D399] group-hover:bg-[#059669]">
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Support-desk banner */}
          <div className="relative mt-8 overflow-hidden rounded-3xl bg-[#FFFFFF] px-6 py-7 text-[#0F172A] sm:px-9">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#EA580C]/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#10B981]/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#F1F5F9]/15 bg-[#F1F5F9]/10 text-[#059669]">
                  <UserCheck size={19} />
                </span>
                <div>
                  <p className="font-customer-display text-[24px] leading-tight tracking-tight sm:text-[26px]">
                    A trade we have not listed? We still want to hear it.
                  </p>
                  <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-6 text-[#94A3B8]">
                    The network grows with the skills of its partners. Talk to the partner desk
                    and we will route your expertise to the right customers.
                  </p>
                </div>
              </div>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#F1F5F9]/15 bg-[#F1F5F9]/5 p-3.5 transition hover:border-[#34D399] lg:w-[300px]"
              >
                <span className="text-[14px] font-bold text-[#F8FAFC]">{SUPPORT_PHONE}</span>
                <PhoneCall size={15} className="text-[#059669]" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Earnings                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="earnings"
        className="scroll-mt-[74px] bg-[#FFFFFF] py-20 sm:py-24"
      >
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[620px]">
              <SectionLabel index="02">Earnings</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[52px]">
                Know your number
                <br className="hidden sm:block" /> <span className="italic text-[#059669]">before</span> you sign up.
              </h2>
              <p className="mt-4 max-w-[480px] text-[15px] leading-7 text-[#64748B]">
                No hidden deductions and no haggling at the doorstep. Move the slider to see
                what a month of work could settle at.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 lg:flex">
              <ShieldCheck size={13} className="text-[#059669]" />
              <Micro className="text-[#64748B]">Fee always shown first</Micro>
            </div>
          </div>

          <div className="mt-12">
            <EarningsCalculator />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Benefits                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section id="benefits" className="scroll-mt-[74px] bg-[#FFFFFF] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="max-w-[680px]">
            <SectionLabel index="03">Why partner</SectionLabel>
            <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[52px]">
              Built for the way
              <br className="hidden sm:block" /> you actually work.
            </h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-[#64748B]">
              You have spent years learning your craft. The platform should make it easier to
              earn from it — not harder.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <div key={benefit.title} className="group flex gap-4 border-t border-[#CBD5E1]/70 py-7">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-[#059669] shadow-sm transition group-hover:border-[#059669]/30 group-hover:bg-[#ECFDF5]">
                  <benefit.icon size={17} />
                </span>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[12px] font-bold tracking-[0.14em] text-[#059669]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-[15.5px] font-extrabold tracking-tight text-[#0F172A]">
                      {benefit.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#475569]">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="how-it-works"
        className="scroll-mt-[74px] bg-[#FFFFFF] py-20 sm:py-24"
      >
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[600px]">
              <SectionLabel index="04">Onboarding</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[52px]">
                Four steps.
                <br className="hidden sm:block" /> Usually under 48 hours.
              </h2>
            </div>
            <p className="max-w-[330px] text-[15px] leading-7 text-[#64748B]">
              Most professionals finish verification in a day. Our partner desk stays on call
              while you do.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <div key={step.title} className="border-t border-[#CBD5E1] pt-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-customer-display text-[38px] italic leading-none tracking-[-0.02em] text-[#059669]/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="rounded-full border border-[#F6CDAA] bg-[#FFF7ED] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#C2410C]">
                    {step.duration}
                  </span>
                </div>
                <h3 className="mt-6 text-[15.5px] font-extrabold tracking-tight text-[#0F172A]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[#475569]">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goToLogin}
              className="landing-sweep relative flex h-[52px] items-center gap-2 overflow-hidden rounded-full bg-[#FFFFFF] px-6 text-[14px] font-bold text-[#0F172A] transition hover:-translate-y-0.5 hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            >
              Start your application
              <ArrowRight size={15} strokeWidth={2.6} />
            </button>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              <Timer size={12} /> Average application time · 4 min
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Requirements                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="requirements" className="scroll-mt-[74px] bg-[#FFFFFF] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div>
            <SectionLabel index="05">Before you start</SectionLabel>
            <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[48px]">
              Bring your skill.
              <br className="hidden sm:block" /> We handle the rest.
            </h2>
            <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-[#64748B]">
              Verification protects you as much as the customer. It is a one-time check, and
              the partner team helps you through each document.
            </p>

            <div className="mt-8 space-y-2.5">
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#059669] text-[#F1F5F9]">
                  <PhoneCall size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">
                    Partner desk
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#64748B]">
                    {SUPPORT_PHONE} · Mon–Sat, 9am–8pm
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#94A3B8]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Partner%20application`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF7ED] text-[#EA580C]">
                  <Mail size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">
                    Email the partner team
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#64748B]">
                    {SUPPORT_EMAIL}
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#94A3B8]" />
              </a>
            </div>

            <p className="mt-6 flex items-start gap-2 text-[12px] leading-5 text-[#64748B]">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#059669]" />
              Police verification may be requested for on-site work in some cities. We tell
              you upfront — nothing is charged for it.
            </p>
          </div>

          {/* Application checklist panel */}
          <div className="rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_36px_80px_-48px_rgba(15,23,42,0.35)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Micro className="text-[#94A3B8]">Your application</Micro>
                <p className="mt-2 font-customer-display text-[24px] leading-tight tracking-[-0.01em] text-[#0F172A]">
                  Five things to keep ready
                </p>
              </div>
              <span className="rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#047857]">
                4 min
              </span>
            </div>

            <ul className="mt-5">
              {REQUIREMENTS.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-t border-[#F1F5F9] py-3.5 first:border-t-0 first:pt-1"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#059669]/30 bg-[#ECFDF5] text-[#059669]">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-[13.5px] leading-5 text-[#334155]">{item}</span>
                  <span className="mt-0.5 shrink-0 text-[11px] font-bold tracking-[0.12em] text-[#CBD5E1]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <Clock size={13} className="shrink-0 text-[#059669]" />
              <p className="text-[12px] leading-4 text-[#64748B]">
                Most applicants have everything ready and verified within a day.
              </p>
            </div>

            <button
              type="button"
              onClick={goToLogin}
              className="landing-sweep relative mt-4 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#059669] text-[14px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(5,150,105,0.85)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20"
            >
              Start verification
              <ArrowRight size={14} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Partner stories                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[#E2E8F0] bg-[#FFFFFF] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel index="06">Partner stories</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[48px]">
                What professionals
                <br className="hidden sm:block" /> <span className="italic">tell us.</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
              <Star size={12} className="fill-[#F97316] text-[#F97316]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                4.8 average partner rating
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="group flex flex-col rounded-[26px] border border-[#E2E8F0] bg-[#F8FAFC] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#CBD5E1] hover:bg-[#FFFFFF] hover:shadow-[0_28px_56px_-32px_rgba(15,23,42,0.4)]"
              >
                <div className="flex items-start justify-between">
                  <Quote size={22} className="text-[#059669]/40" />
                  <span className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star key={star} size={11} className="fill-[#F97316] text-[#F97316]" />
                    ))}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 font-customer-display text-[19px] leading-[1.35] tracking-[-0.005em] text-[#1E293B]">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-[#E2E8F0] pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFFFFF] font-customer-display text-[16px] italic text-[#6EE7B7]">
                    {testimonial.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-[#0F172A]">
                      {testimonial.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#64748B]">
                      {testimonial.trade}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-customer-display text-[19px] leading-none text-[#047857]">
                      {testimonial.earning}
                    </span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                      {testimonial.note}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section id="faqs" className="scroll-mt-[74px] bg-[#F8FAFC] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            <SectionLabel index="07">Questions</SectionLabel>
            <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[46px]">
              Everything partners
              <br className="hidden sm:block" /> ask first.
            </h2>
            <p className="mt-4 max-w-[330px] text-[15px] leading-7 text-[#64748B]">
              Still unsure? The partner desk answers on call or email, six days a week.
            </p>

            <div className="mt-7 rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <Micro className="text-[#94A3B8]">Talk to a person</Micro>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="mt-3 flex items-center gap-3 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3.5 py-3 transition hover:border-[#059669]/30"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
                  <PhoneCall size={14} />
                </span>
                <span className="flex-1">
                  <span className="text-[13.5px] font-extrabold text-[#0F172A]">
                    {SUPPORT_PHONE}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#64748B]">
                    Mon–Sat · 9am–8pm
                  </span>
                </span>
                <ArrowUpRight size={13} className="text-[#94A3B8]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2.5 flex items-center gap-2 px-1 text-[12px] font-medium text-[#64748B] transition hover:text-[#059669]"
              >
                <Mail size={11} /> {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="border-t border-[#CBD5E1]/70">
            {FAQS.map((faq, index) => (
              <details
                key={faq.q}
                className="group border-b border-[#E2E8F0] py-5"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
                  <span className="text-[12px] font-bold tracking-[0.14em] text-[#059669]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-[15px] font-bold tracking-tight text-[#0F172A]">
                    {faq.q}
                  </span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] text-[#475569] transition group-open:rotate-45 group-open:border-[#059669]/50 group-open:text-[#059669]">
                    <span className="relative block h-2 w-2">
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[600px] pl-[34px] text-[13.5px] leading-6 text-[#475569]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Final CTA                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-[#FFFFFF] py-16 text-[#0F172A] sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(46% 60% at 78% 10%, rgba(5,150,105,0.18) 0%, transparent 65%), radial-gradient(40% 50% at 8% 90%, rgba(249,115,22,0.10) 0%, transparent 60%)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 select-none font-customer-display text-[16vw] italic leading-none text-[#F1F5F9]/[0.04] xl:block"
        >
          partner.
        </span>
        <div className="relative mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="h-px w-9 bg-[#34D399]" />
            <span className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
              Join the network
            </span>
          </div>
          <h2 className="mt-5 max-w-[820px] font-customer-display text-[46px] leading-[0.96] tracking-[-0.025em] text-[#0F172A] sm:text-[64px] 2xl:text-[76px]">
            Your next job is
            <br className="hidden sm:block" />{' '}
            <span className="relative inline-block italic text-[#059669]">
              already in your area.
              <svg
                aria-hidden
                viewBox="0 0 220 16"
                fill="none"
                className="absolute -bottom-1 left-0 h-3 w-full text-[#F97316]/70"
              >
                <path
                  d="M3 11C48 4 140 2 217 8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="landing-draw"
                />
              </svg>
            </span>
          </h2>
          <p className="mt-5 max-w-[500px] text-[16px] leading-7 text-[#334155]">
            Create your partner account with OTP, finish verification and start receiving
            requests from the customers closest to you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goToLogin}
              className="landing-sweep relative flex h-[54px] items-center justify-center gap-2 overflow-hidden rounded-full bg-[#059669] px-7 text-[15px] font-bold text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30"
            >
              Apply in 4 minutes
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
              className="flex h-[54px] items-center justify-center gap-2 rounded-full border border-[#334155] px-6 text-[14px] font-bold text-[#334155] transition hover:border-[#059669] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
            >
              <PhoneCall size={14} />
              Talk to the partner team
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
            {['No joining fee', 'No monthly subscription', 'Weekly payouts'].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#475569]"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
                  <Check size={9} strokeWidth={3.5} />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.85fr_0.85fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <Logo size={38} className="rounded-xl ring-1 ring-[#E2E8F0]" />
                <span className="text-[18px] font-extrabold tracking-tight text-[#0F172A]">
                  Lucky<span className="text-[#F97316]">Seva</span>
                </span>
                <span className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#059669]">
                  Partner
                </span>
              </div>
              <p className="mt-4 max-w-[300px] text-[12.5px] leading-6 text-[#64748B]">
                The professional side of LuckySeva — jobs matched to your trade, transparent
                earnings and weekly payouts.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {['UPI', 'IMPS', 'Bank transfer', 'Weekly'].map((method) => (
                  <span
                    key={method}
                    className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#64748B]"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#475569]">
                Partner programme
              </p>
              <ul className="mt-4 space-y-2.5 text-[12.5px]">
                {navItems.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToId(item.id)}
                      className="transition hover:text-[#059669]"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={goToLogin} className="transition hover:text-[#059669]">
                    Create account
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#475569]">
                Account
              </p>
              <ul className="mt-4 space-y-2.5 text-[12.5px]">
                <li>
                  <button type="button" onClick={goToLogin} className="transition hover:text-[#059669]">
                    Partner login
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToId('requirements')}
                    className="transition hover:text-[#059669]"
                  >
                    Verification checklist
                  </button>
                </li>
                <li>
                  <a
                    href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                    className="flex items-center gap-1.5 transition hover:text-[#059669]"
                  >
                    <PhoneCall size={10} /> Partner desk
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center gap-1.5 transition hover:text-[#059669]"
                  >
                    <Mail size={10} /> Email support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#475569]">
                LuckySeva for customers
              </p>
              <ul className="mt-4 space-y-2.5 text-[12.5px]">
                <li>
                  <a
                    href={CUSTOMER_SITE_URL}
                    className="inline-flex items-center gap-1.5 transition hover:text-[#059669]"
                  >
                    Book a home service <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href={CUSTOMER_SITE_URL}
                    className="inline-flex items-center gap-1.5 transition hover:text-[#059669]"
                  >
                    Visit luckyseva.in <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                    className="flex items-center gap-1.5 transition hover:text-[#059669]"
                  >
                    <PhoneCall size={10} /> {SUPPORT_PHONE}
                  </a>
                </li>
              </ul>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <Briefcase size={13} className="text-[#059669]" />
                <span className="text-[11px] leading-4 text-[#64748B]">
                  15 trades · 180+ service types
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-[#E2E8F0] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#475569]">
              © 2026 LuckySeva · All rights reserved
            </p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#475569]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={10} className="text-[#059669]" /> Verified customers
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={10} className="text-[#059669]" /> Transparent payouts
              </span>
              <span className="flex items-center gap-1.5">
                <UserCheck size={10} className="text-[#059669]" /> Real support
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
