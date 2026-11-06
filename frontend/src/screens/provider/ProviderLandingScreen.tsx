import { useState } from 'react';
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
// Theme matches the customer site: light canvas, emerald accent and slate
// borders, on top of a dark hero and footer. Partner pages add monospaced
// labels and a grotesk display face for the operations feel.
const SUPPORT_PHONE = '1800-200-9876';
const SUPPORT_EMAIL = 'partners@luckyseva.com';

const inr = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value))}`;

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

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */
const Micro = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${className}`}
  >
    {children}
  </span>
);

const SectionLabel = ({ index, children }: { index: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <Micro className="text-[#64748B]">{index}</Micro>
    <span aria-hidden className="h-px w-7 bg-[#CBD5E1]" />
    <Micro className="text-[#64748B]">{children}</Micro>
  </div>
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
        className="pointer-events-none absolute -inset-10 rounded-[48px] bg-[radial-gradient(60%_60%_at_70%_0%,rgba(52,211,153,0.16),transparent_70%)] blur-xl"
      />

      {/* Floating glass badges — selling points orbiting the card */}
      <div
        className="landing-float absolute -left-6 top-24 z-10 hidden items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/90 px-3 py-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)] backdrop-blur-md xl:flex"
        style={{ animationDelay: '0.8s' }}
      >
        <Banknote size={14} className="text-[#059669]" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#334155]">
          Weekly payout
        </span>
      </div>
      <div
        className="landing-float-slow absolute -right-5 bottom-40 z-10 hidden items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/90 px-3 py-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)] backdrop-blur-md xl:flex"
        style={{ animationDelay: '1.6s' }}
      >
        <Star size={14} className="fill-[#F59E0B] text-[#F59E0B]" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#334155]">
          4.8 partner rating
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-[0_36px_80px_-42px_rgba(15,23,42,0.5)] ring-1 ring-[#0F172A]/5 transition duration-300 hover:ring-[#059669]/25">
        <div aria-hidden className="h-[3px] rounded-full bg-[linear-gradient(90deg,#10B981_0%,#059669_45%,#D4FA6E_100%)]" />
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-center gap-3">
            <Logo size={38} className="rounded-lg shadow-sm ring-1 ring-[#0F172A]/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </p>
              <p className="mt-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8]">
                Partner
              </p>
            </div>
            <span className="rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#059669]">
              Sign in
            </span>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#059669]" />
            <Micro className="text-[#94A3B8]">Partner sign in</Micro>
          </div>
          <h2 className="mt-2 font-partner-display text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0F172A]">
            Your jobs are waiting.
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-5 text-[#64748B]">
            Sign in with your registered mobile number to see requests and earnings.
          </p>

          <form onSubmit={submit} className="mt-5">
            <label
              htmlFor="partner-landing-phone"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]"
            >
              Mobile number
            </label>
            <div
              className={`mt-2 flex h-[50px] items-center gap-3 rounded-xl border bg-[#FFFFFF] px-3.5 transition focus-within:bg-white focus-within:ring-4 focus-within:ring-[#059669]/10 ${
                touched && !valid
                  ? 'border-[#F87171]/60 focus-within:border-[#F87171]'
                  : 'border-[#E2E8F0] focus-within:border-[#059669]/60'
              }`}
            >
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[14px] font-semibold text-[#0F172A]">
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
                className="h-full min-w-0 flex-1 bg-transparent text-[16.5px] font-medium tracking-wide text-[#0F172A] outline-none placeholder:text-[14px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#94A3B8]"
              />
            </div>
            {touched && !valid && (
              <p className="mt-1.5 text-[12px] font-semibold text-[#F87171]">
                Enter a valid 10-digit Indian mobile number.
              </p>
            )}

            <button
              type="submit"
              disabled={!valid}
              className="landing-sweep relative mt-4 flex h-[50px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#059669] text-[15px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(5,150,105,0.85)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Continue with OTP
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>

            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <LockKeyhole size={10} /> Secure OTP sign-in
              </span>
            </div>
          </form>

          <p className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[11px] leading-4 text-[#64748B]">
            New professional? Continue with the same number — if it is not registered
            yet, we open the partner application.
          </p>

          <p className="mt-4 border-t border-[#E2E8F0] pt-3.5 text-center text-[11px] leading-4 text-[#64748B]">
            By continuing you agree to the LuckySeva Partner Terms and Privacy Policy.
          </p>
        </div>
      </div>

      {/* Live request preview — shows the product, not just a form. */}
      <div className="relative mt-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.18)]">
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
                className="flex items-center gap-2.5 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-2.5 py-2"
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
            <p className="text-[#64748B] text-xs">No active requests</p>
          ) : jobFeed.map((job) => (
            <div
              key={job.title}
              className="flex items-center gap-2.5 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-2.5 py-2"
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
          ))}
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
    <div className="grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
      {/* Controls */}
      <div className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.18)] transition duration-300 hover:border-[#CBD5E1] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#94A3B8]">Jobs per week</Micro>
            <p className="mt-1 font-partner-display text-[30px] font-bold leading-none text-[#0F172A]">
              {jobsPerWeek}
              <span className="ml-1 text-[13px] font-medium text-[#94A3B8]">jobs</span>
            </p>
          </div>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#64748B]">
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
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/40 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#FFFFFF] [&::-webkit-slider-thumb]:bg-[#059669] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(5,150,105,0.18)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#FFFFFF] [&::-moz-range-thumb]:bg-[#059669] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(5,150,105,0.18)] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent"
          style={{
            background: `linear-gradient(to right, #10B981 0%, #10B981 ${pct}%, rgba(15,23,42,0.08) ${pct}%, rgba(15,23,42,0.08) 100%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[#475569]">
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
                  className={`h-10 rounded-lg border font-mono text-[13px] font-semibold transition ${
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

        <div className="mt-6 rounded-xl border border-[#059669]/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.02))] p-4">
          <Micro className="text-[#059669]">Estimated take-home</Micro>
          <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-partner-display text-[38px] font-bold leading-none tracking-[-0.03em] text-[#059669]">
              {inr(net)}
            </p>
            <span className="pb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">
              per month
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <Wallet size={11} className="text-[#059669]" />
            About {inr(weekly)} paid out every Monday
          </p>
        </div>

        <p className="mt-auto pt-4 text-[11px] leading-4 text-[#64748B]">
          Illustration only, using a 15% per-job platform fee. Actual earnings depend on
          your trade, city, availability and the jobs you accept.
        </p>
      </div>

      {/* Payout preview */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.18)] transition duration-300 hover:border-[#CBD5E1] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#94A3B8]">Payout preview</Micro>
            <p className="mt-2 font-partner-display text-[19px] font-bold tracking-[-0.01em] text-[#0F172A]">
              What lands in your account
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#059669]">
            <CalendarCheck size={10} /> Weekly
          </span>
        </div>

        <div className="mt-6 flex h-[128px] items-end gap-2.5">
          {weekBars.map((bar, index) => (
            <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-[0.02em] text-[#64748B]">
                {inr(weekValues[index])}
              </span>
              <div
                className={`w-full rounded-t-[3px] transition-all duration-300 ${
                  index === 3 ? 'bg-[#059669]' : 'bg-[#059669]/20'
                }`}
                style={{ height: `${Math.max(10, (bar / maxBar) * 68)}px` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">
                W{index + 1}
              </span>
            </div>
          ))}
        </div>

        <dl className="mt-5 space-y-0 border-t border-[#E2E8F0] text-[13.5px]">
          {[
            { label: 'Gross this month', value: inr(gross), muted: true },
            { label: 'Platform fee · 15%', value: `−${inr(fee)}`, muted: true },
            { label: 'You keep', value: inr(net), strong: true },
            { label: 'Next payout · Monday', value: inr(weekly), payout: true },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-[#F1F5F9] py-3 last:border-b-0"
            >
              <dt
                className={
                  row.strong
                    ? 'font-semibold text-[#059669]'
                    : row.payout
                      ? 'text-[#64748B]'
                      : 'text-[#64748B]'
                }
              >
                {row.label}
              </dt>
              <dd
                className={
                  row.strong
                    ? 'font-partner-display text-[17px] font-bold text-[#059669]'
                    : row.payout
                      ? 'font-mono text-[13.5px] font-bold text-[#0F172A]'
                      : 'font-semibold text-[#334155]'
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto space-y-2 pt-5">
          {[
            { icon: Banknote, label: 'Bank transfer · IMPS' },
            { icon: Smartphone, label: 'UPI · same-day after settlement' },
            { icon: ShieldCheck, label: 'Statement for every payout' },
          ].map((item) => (
            <p key={item.label} className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <item.icon size={11} className="text-[#059669]" />
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
    { label: 'Why partner', id: 'benefits' },
    { label: 'Earnings', id: 'earnings' },
    { label: 'How it works', id: 'how-it-works' },
    { label: 'Requirements', id: 'requirements' },
  ];

  const marqueeItems = [
    'AC service · Pune · ₹1,200',
    'Deep cleaning · Bengaluru · ₹2,400',
    'Switchboard repair · Delhi NCR · ₹650',
    'Plumbing · Hyderabad · ₹900',
    'Carpentry · Mumbai · ₹1,800',
    'Appliance repair · Chennai · ₹1,100',
    'Salon at home · Jaipur · ₹1,500',
    'Pest control · Ahmedabad · ₹2,100',
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
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0]/80 bg-[#FFFFFF]/90 backdrop-blur-xl">
        {/* Lime hairline along the header edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent_8%,rgba(52,211,153,0.55)_50%,transparent_92%)]"
        />
        <div className="mx-auto flex h-[74px] w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-6 px-5 sm:px-8">
          <button
            type="button"
            onClick={() => scrollToId('top')}
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
            aria-label="LuckySeva Partner home"
          >
            <Logo size={36} className="rounded-lg shadow-sm ring-1 ring-[#0F172A]/10" />
            <span className="text-left">
              <span className="block text-[17px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </span>
              <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#059669]">
                Partner
              </span>
            </span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToId(item.id)}
                className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goToLogin}
              className="hidden h-10 items-center rounded-full border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-[14px] font-bold text-[#334155] transition hover:border-[#34D399] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399] sm:flex"
            >
              Partner login
            </button>
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-10 items-center gap-1.5 rounded-full bg-[#0F172A] px-4 text-[14px] font-bold text-[#FFFFFF] transition hover:-translate-y-0.5 hover:bg-[#12402F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399] focus-visible:ring-offset-2"
            >
              Apply now
              <ArrowRight size={14} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </header>

      <div id="top" />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-[#0F172A] text-[#F8FAFC]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(52% 58% at 78% 2%, rgba(52,211,153,0.20) 0%, transparent 66%), radial-gradient(42% 50% at 4% 28%, rgba(4,120,87,0.20) 0%, transparent 64%), radial-gradient(30% 30% at 50% 100%, rgba(52,211,153,0.08) 0%, transparent 70%)',
          }}
        />
        {/* Fine dot grain — gives the canvas texture instead of flatness */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(rgba(148,163,184,0.35) 0.5px, transparent 0.5px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to bottom, black, transparent 42%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 42%)',
          }}
        />
        {/* Lime hairline bleeding from the top edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/4 top-0 h-24 w-px bg-[linear-gradient(to_bottom,rgba(52,211,153,0.4),transparent)]"
        />

        <div className="relative mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-12 px-4 pb-12 pt-10 sm:px-8 sm:pb-14 sm:pt-12 2xl:pb-28 2xl:pt-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(350px,392px)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(390px,430px)] lg:gap-16 lg:pb-20 lg:pt-16">
          <div className="landing-rise min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#34D399]/30 bg-[#34D399]/10">
                <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#34D399]" />
              </span>
              <Micro className="text-[#34D399]">The LuckySeva partner programme</Micro>
            </div>

            <h1 className="mt-6 font-partner-display text-[42px] font-bold leading-[0.98] tracking-[-0.04em] text-[#F8FAFC] sm:text-[58px] xl:text-[64px] 2xl:text-[76px]">
              Your skill.
              <br />
              Your terms.
              <br />
              <span className="relative inline-block bg-[linear-gradient(92deg,#6EE7B7_0%,#34D399_45%,#A7F3D0_100%)] bg-clip-text text-transparent">
                Your earnings.
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-0 h-[6px] w-full rounded-full bg-[#34D399]/20"
                />
              </span>
            </h1>

            <p className="mt-6 max-w-[510px] text-[15px] leading-7 text-[#94A3B8]">
              Join the professionals behind LuckySeva. Get matched to jobs in your area,
              set your own hours and see every rupee before you accept — with weekly
              payouts and a team that backs you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={goToLogin}
                className="landing-sweep group relative flex h-[52px] items-center justify-center gap-2 overflow-hidden rounded-full bg-[#059669] px-7 text-[15px] font-bold text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20"
              >
                Start your application
                <ArrowRight size={16} strokeWidth={2.6} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('earnings')}
                className="group flex h-[52px] items-center justify-center gap-2 rounded-full border border-[#334155] bg-[#1E293B]/70 px-6 text-[15px] font-bold text-[#F8FAFC] backdrop-blur-sm transition hover:border-[#34D399] hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
              >
                Estimate earnings
                <ChevronRight size={15} className="text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#34D399]" />
              </button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
              {['No joining fee', 'Weekly payouts', 'Fee shown before you accept'].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#94A3B8]">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#34D399]/15 text-[#34D399]">
                    <Check size={9} strokeWidth={3.5} />
                  </span>
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-9 grid max-w-[520px] grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08]">
              {[
                { value: '18,400+', label: 'Partners' },
                { value: '48 hrs', label: 'Verification' },
                { value: '4.8/5', label: 'Partner rating' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="group relative bg-[#0F172A] px-3 py-3.5 transition hover:bg-[#0C1B2E]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px w-full scale-x-0 bg-[#34D399]/60 transition-transform duration-300 group-hover:scale-x-100"
                  />
                  <p className="font-partner-display text-[17px] font-bold leading-none tracking-tight text-[#F8FAFC] transition group-hover:text-[#34D399]">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="landing-rise relative w-full max-w-[392px] 2xl:max-w-[430px] justify-self-center lg:justify-self-end"
            style={{ animationDelay: '120ms' }}
          >
            <LoginCard jobFeed={jobFeed} loadingFeed={loadingFeed} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Live job ticker                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="overflow-hidden border-y border-[#E2E8F0] bg-[#F8FAFC] py-4"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        }}
      >
        <div className="landing-marquee flex w-max items-center gap-8 whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={index} className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748B]">
              <span className="h-1 w-1 rounded-full bg-[#059669]" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Earnings                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section id="earnings" className="scroll-mt-[74px] bg-[#F8FAFC] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[620px]">
              <SectionLabel index="01">Earnings</SectionLabel>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-[44px]">
                Know your number
                <br className="hidden sm:block" /> before you sign up.
              </h2>
              <p className="mt-4 max-w-[480px] text-[14px] leading-7 text-[#475569]">
                No hidden deductions and no haggling at the doorstep. Move the slider to
                see what a week of work could settle at.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 lg:flex">
              <ShieldCheck size={13} className="text-[#059669]" />
              <Micro className="text-[#94A3B8]">Fee always shown first</Micro>
            </div>
          </div>

          <div className="mt-10">
            <EarningsCalculator />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Benefits                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section id="benefits" className="scroll-mt-[74px] border-y border-[#E2E8F0] bg-[#F1F5F9] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="max-w-[680px]">
            <SectionLabel index="02">Why partner</SectionLabel>
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-[44px]">
              Built for the way
              <br className="hidden sm:block" /> you actually work.
            </h2>
            <p className="mt-4 max-w-[520px] text-[14px] leading-7 text-[#475569]">
              You have spent years learning your craft. The platform should make it easier
              to earn from it — not harder.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <div
                key={benefit.title}
                className="group flex gap-4 border-t border-[#CBD5E1]/70 py-7"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/70 text-[#059669] transition group-hover:border-[#059669]/30 group-hover:bg-[#FFFFFF]">
                  <benefit.icon size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Micro className="text-[#64748B]">{String(index + 1).padStart(2, '0')}</Micro>
                    <h3 className="font-partner-display text-[16px] font-semibold tracking-[-0.01em] text-[#0F172A]">
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
      {/* How it works — lime block                                        */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-[74px] bg-[#FFFFFF] py-20 text-[#0F172A] sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[600px]">
              <div className="flex items-center gap-3">
                <Micro className="text-[#059669]">03</Micro>
                <span aria-hidden className="h-px w-7 bg-[#CBD5E1]" />
                <Micro className="text-[#059669]">Onboarding</Micro>
              </div>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[46px]">
                Four steps.
                <br className="hidden sm:block" /> Usually under 48 hours.
              </h2>
            </div>
            <p className="max-w-[330px] text-[14px] leading-7 text-[#64748B]">
              Most professionals finish verification in a day. Our partner desk stays on
              call while you do.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <div key={step.title} className="border-t border-[#E2E8F0] pt-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-partner-display text-[36px] font-bold leading-none tracking-[-0.04em] text-[#0F172A]/15">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#059669]">
                    {step.duration}
                  </span>
                </div>
                <h3 className="mt-6 font-partner-display text-[15px] font-semibold tracking-[-0.01em]">
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
              className="flex h-[52px] items-center gap-2 rounded-full bg-[#0F172A] px-6 text-[14px] font-bold text-[#FFFFFF] transition hover:-translate-y-0.5 hover:bg-[#12402F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
            >
              Start your application
              <ArrowRight size={15} strokeWidth={2.6} />
            </button>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#64748B]">
              <Timer size={12} /> Average application time · 4 min
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Requirements                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="requirements" className="scroll-mt-[74px] bg-[#F8FAFC] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div>
            <SectionLabel index="04">Before you start</SectionLabel>
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-[42px]">
              Bring your skill.
              <br className="hidden sm:block" /> We handle the rest.
            </h2>
            <p className="mt-4 max-w-[420px] text-[14px] leading-7 text-[#475569]">
              Verification protects you as much as the customer. It is a one-time check,
              and the partner team helps you through each document.
            </p>

            <div className="mt-8 space-y-2.5">
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#059669] text-[#F1F5F9]">
                  <PhoneCall size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">Partner desk</span>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-[0.06em] text-[#64748B]">
                    {SUPPORT_PHONE} · Mon–Sat, 9am–8pm
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#94A3B8]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Partner%20application`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF7ED] text-[#EA580C]">
                  <Mail size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">Email the partner team</span>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-[0.06em] text-[#64748B]">
                    {SUPPORT_EMAIL}
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#94A3B8]" />
              </a>
            </div>

            <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#64748B]">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#059669]" />
              Police verification may be requested for on-site work in some cities. We
              tell you upfront — nothing is charged for it.
            </p>
          </div>

          {/* Application checklist panel */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.18)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Micro className="text-[#94A3B8]">Your application</Micro>
                <p className="mt-2 font-partner-display text-[19px] font-bold tracking-[-0.01em] text-[#0F172A]">
                  Five things to keep ready
                </p>
              </div>
              <span className="rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#059669]">
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
                  <span className="flex-1 text-[13px] leading-5 text-[#334155]">{item}</span>
                  <Micro className="mt-0.5 shrink-0 text-[#94A3B8]">{String(index + 1).padStart(2, '0')}</Micro>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <Clock size={13} className="shrink-0 text-[#059669]" />
              <p className="text-[11.5px] leading-4 text-[#64748B]">
                Most applicants have everything ready and verified within a day.
              </p>
            </div>

            <button
              type="button"
              onClick={goToLogin}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0F172A] text-[14px] font-bold text-[#FFFFFF] transition hover:bg-[#12402F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
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
      <section className="border-y border-[#E2E8F0] bg-[#F1F5F9] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel index="05">Partner stories</SectionLabel>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-[42px]">
                What professionals
                <br className="hidden sm:block" /> tell us.
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#CBD5E1]/70 bg-[#FFFFFF] px-4 py-2">
              <Star size={12} className="fill-[#F59E0B] text-[#F59E0B]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748B]">
                4.8 average partner rating
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_-32px_rgba(15,23,42,0.4)]"
              >
                <div className="flex items-start justify-between">
                  <Quote size={20} className="text-[#CBD5E1]" />
                  <span className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star key={star} size={10} className="fill-[#F59E0B] text-[#F59E0B]" />
                    ))}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 text-[13.5px] leading-6 text-[#334155]">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-[#F1F5F9] pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9] font-partner-display text-[13px] font-bold text-[#0F172A]">
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
                    <span className="block font-mono text-[12px] font-bold text-[#059669]">
                      {testimonial.earning}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">
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
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            <SectionLabel index="06">Questions</SectionLabel>
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-[40px]">
              Everything partners
              <br className="hidden sm:block" /> ask first.
            </h2>
            <p className="mt-4 max-w-[330px] text-[14px] leading-7 text-[#94A3B8]">
              Still unsure? The partner desk answers on call or email, six days a week.
            </p>

            <div className="mt-7 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
              <Micro className="text-[#94A3B8]">Talk to a person</Micro>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="mt-3 flex items-center gap-3 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-3 transition hover:border-[#059669]/30"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
                  <PhoneCall size={14} />
                </span>
                <span className="flex-1">
                  <span className="text-[13px] font-extrabold tracking-[0.04em] text-[#0F172A]">
                    {SUPPORT_PHONE}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-[#64748B]">Mon–Sat · 9am–8pm</span>
                </span>
                <ArrowUpRight size={13} className="text-[#94A3B8]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[#64748B] transition hover:text-[#059669]"
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
                  <Micro className="text-[#94A3B8]">{String(index + 1).padStart(2, '0')}</Micro>
                  <span className="flex-1 font-partner-display text-[15px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                    {faq.q}
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#CBD5E1] text-[#475569] transition group-open:rotate-45 group-open:border-[#059669]/50 group-open:text-[#059669]">
                    <span className="relative block h-2 w-2">
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[600px] pl-[30px] text-[13px] leading-6 text-[#475569]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Final CTA — inverted lime band                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-[#0F172A] py-16 text-[#F1F5F9] sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(rgba(241,245,249,0.5) 0.8px, transparent 0.8px)',
            backgroundSize: '22px 22px',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none font-partner-display text-[20vw] font-bold leading-none tracking-[-0.06em] text-[#F1F5F9]/[0.04]"
        >
          PARTNER
        </span>
        <div className="relative mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <Micro className="text-[#34D399]">Join the network</Micro>
          <h2 className="mt-4 max-w-[760px] font-partner-display text-[38px] font-bold leading-[0.98] tracking-[-0.04em] sm:text-[56px]">
            Your next job is
            <br className="hidden sm:block" /> already in your area.
          </h2>
          <p className="mt-4 max-w-[460px] text-[14px] leading-7 text-[#94A3B8]">
            Create your partner account with OTP, finish verification and start receiving
            requests from the customers closest to you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#059669] px-7 text-[15px] font-bold text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30"
            >
              Apply in 4 minutes
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
              className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-[#334155] px-6 text-[14px] font-bold text-[#F1F5F9] transition hover:border-[#34D399] hover:bg-[#1E293B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
            >
              <PhoneCall size={14} />
              Talk to the partner team
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
            {['No joining fee', 'No monthly subscription', 'Weekly payouts'].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]"
              >
                <Check size={10} strokeWidth={3.5} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-[#F1F5F9]/10 bg-[#0F172A] text-[#94A3B8]">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.85fr_0.85fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <Logo size={36} className="rounded-lg ring-1 ring-white/10" />
                <span className="text-[17px] font-extrabold tracking-tight text-[#F8FAFC]">
                  Lucky<span className="text-[#F97316]">Seva</span>
                </span>
                <span className="rounded border border-[#34D399]/25 bg-[#34D399]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
                  Partner
                </span>
              </div>
              <p className="mt-4 max-w-[300px] text-[12px] leading-6 text-[#64748B]">
                The professional side of LuckySeva — jobs matched to your trade, transparent
                earnings and weekly payouts.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {['UPI', 'IMPS', 'Bank transfer', 'Weekly'].map((method) => (
                  <span
                    key={method}
                    className="rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#64748B]"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <Micro className="text-[#64748B]">Partner programme</Micro>
              <ul className="mt-4 space-y-2.5 text-[12px]">
                {navItems.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToId(item.id)}
                      className="transition hover:text-[#34D399]"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={goToLogin} className="transition hover:text-[#34D399]">
                    Create account
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <Micro className="text-[#64748B]">Account</Micro>
              <ul className="mt-4 space-y-2.5 text-[12px]">
                <li>
                  <button type="button" onClick={goToLogin} className="transition hover:text-[#34D399]">
                    Partner login
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToId('requirements')}
                    className="transition hover:text-[#34D399]"
                  >
                    Verification checklist
                  </button>
                </li>
                <li>
                  <a
                    href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                    className="flex items-center gap-1.5 transition hover:text-[#34D399]"
                  >
                    <PhoneCall size={10} /> Partner desk
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center gap-1.5 transition hover:text-[#34D399]"
                  >
                    <Mail size={10} /> Email support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <Micro className="text-[#64748B]">LuckySeva for customers</Micro>
              <ul className="mt-4 space-y-2.5 text-[12px]">
                <li>
                  <a
                    href={CUSTOMER_SITE_URL}
                    className="inline-flex items-center gap-1.5 transition hover:text-[#34D399]"
                  >
                    Book a home service <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href={CUSTOMER_SITE_URL}
                    className="inline-flex items-center gap-1.5 transition hover:text-[#34D399]"
                  >
                    Visit luckyseva.in <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                    className="flex items-center gap-1.5 transition hover:text-[#34D399]"
                  >
                    <PhoneCall size={10} /> {SUPPORT_PHONE}
                  </a>
                </li>
              </ul>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                <Briefcase size={13} className="text-[#34D399]" />
                <span className="text-[10.5px] leading-4 text-[#64748B]">
                  15 trades · 180+ service types
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#475569]">
              © 2026 LuckySeva · All rights reserved
            </p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#475569]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={10} /> Verified customers
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={10} /> Transparent payouts
              </span>
              <span className="flex items-center gap-1.5">
                <UserCheck size={10} /> Real support
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
