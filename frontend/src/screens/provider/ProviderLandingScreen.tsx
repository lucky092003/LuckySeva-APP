import { useEffect, useState } from 'react';
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
import { api } from '@/services/api';

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
// The partner site is a dark operations product: graphite canvas, acid-lime
// accent, grotesk display type and monospaced labels. It shares no palette,
// type or section order with the customer site.
const LIME = '#34D399';

const SUPPORT_PHONE = '1800-200-9876';
const SUPPORT_EMAIL = 'partners@luckyseva.com';
const DEMO_PHONE = '9876543210';

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
/* Service icon lookup                                                 */
/* ------------------------------------------------------------------ */
const getIconForService = (serviceName: string) => {
  const lower = serviceName.toLowerCase();
  if (lower.includes('ac') || lower.includes('cool') || lower.includes('air')) return Snowflake;
  if (lower.includes('switchboard') || lower.includes('electric') || lower.includes('wiring') || lower.includes('zap')) return Zap;
  if (lower.includes('kitchen') || lower.includes('clean') || lower.includes('deep')) return Sparkles;
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('leak')) return Droplets;
  if (lower.includes('carpenter') || lower.includes('wood') || lower.includes('furniture')) return Hammer;
  if (lower.includes('paint') || lower.includes('painting')) return PaintRoller;
  if (lower.includes('beauty') || lower.includes('salon')) return Scissors;
  if (lower.includes('pest')) return Bug;
  if (lower.includes('physio') || lower.includes('physiother')) return Activity;
  if (lower.includes('packer') || lower.includes('mover') || lower.includes('shifting')) return Truck;
  if (lower.includes('cctv') || lower.includes('security')) return Cctv;
  if (lower.includes('cleaning') || lower.includes('laundry')) return Shirt;
  if (lower.includes('lawn') || lower.includes('garden')) return Trees;
  return Sparkles;
};

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
    <span aria-hidden className="h-px w-7 bg-white/15" />
    <Micro className="text-[#94A3B8]">{children}</Micro>
  </div>
);

/* ------------------------------------------------------------------ */
/* Partner login card                                                  */
/* ------------------------------------------------------------------ */
const LoginCard = () => {
  const { navigate } = useApp();
  const [phone, setPhone] = useState(DEMO_PHONE);
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
        className="pointer-events-none absolute -inset-5 rounded-[32px] bg-[radial-gradient(60%_60%_at_70%_0%,rgba(52,211,153,0.14),transparent_70%)]"
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-1.5 shadow-[0_50px_100px_-40px_rgba(0,0,0,1)]">
        <div aria-hidden className="h-[3px] rounded-full bg-[linear-gradient(90deg,#34D399_0%,#34D399_45%,#3F6212_100%)]" />
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-center gap-3">
            <Logo size={38} className="rounded-lg ring-1 ring-white/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold leading-none tracking-tight text-[#F8FAFC]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </p>
              <p className="mt-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">
                Partner
              </p>
            </div>
            <span className="rounded border border-[#34D399]/25 bg-[#34D399]/10 px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
              Login demo
            </span>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            <Micro className="text-[#94A3B8]">Partner sign in</Micro>
          </div>
          <h2 className="mt-2 font-partner-display text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[#F8FAFC]">
            Your jobs are waiting.
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-5 text-[#94A3B8]">
            Sign in with your registered mobile number to see requests and earnings.
          </p>

          <form onSubmit={submit} className="mt-5">
            <label
              htmlFor="partner-landing-phone"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]"
            >
              Mobile number
            </label>
            <div
              className={`mt-2 flex h-[50px] items-center gap-3 rounded-lg border bg-[#1E293B] px-3.5 transition focus-within:bg-[#1E293B] focus-within:ring-2 focus-within:ring-[#34D399]/20 ${
                touched && !valid
                  ? 'border-[#F87171]/60 focus-within:border-[#F87171]'
                  : 'border-white/10 focus-within:border-[#34D399]/60'
              }`}
            >
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[14px] font-semibold text-[#CBD5E1]">
                +91
                <span className="h-4 w-px bg-white/15" />
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
                className="h-full min-w-0 flex-1 bg-transparent text-[16.5px] font-medium tracking-wide text-[#F8FAFC] outline-none placeholder:text-[14px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#64748B]"
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
              className="landing-sweep relative mt-4 flex h-[50px] w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#34D399] text-[15px] font-bold text-[#0F172A] shadow-[0_14px_30px_-14px_rgba(52,211,153,0.8)] transition hover:-translate-y-0.5 hover:bg-[#D4FA6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]/50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
            >
              Continue with OTP
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <LockKeyhole size={10} /> Secure OTP sign-in
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhone(DEMO_PHONE);
                  setTouched(false);
                }}
                className="text-[11px] font-bold text-[#34D399] underline-offset-2 hover:underline"
              >
                Reset demo number
              </button>
            </div>
          </form>

          <p className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-4 text-[#64748B]">
            New professional? Continue with the same number — if it is not registered
            yet, we open the partner application.
          </p>

          <p className="mt-4 border-t border-white/[0.06] pt-3.5 text-center text-[11px] leading-4 text-[#64748B]">
            By continuing you agree to the LuckySeva Partner Terms and Privacy Policy.
          </p>
        </div>
      </div>

      {/* Live request preview — shows the product, not just a form. */}
      <div className="relative mt-3 rounded-2xl border border-white/10 bg-[#1E293B]/90 p-3.5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            <Micro className="text-[#94A3B8]">Requests near you</Micro>
          </span>
          <Micro className="text-[#64748B]">Preview</Micro>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {loadingFeed ? (
            <div className="h-10 w-24 rounded-bg animate-pulse" />
          ) : jobFeed.length === 0 ? (
            <p className="text-[#64748B] text-xs">No active requests</p>
          ) : jobFeed.map((job) => (
            <div
              key={job.title}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#34D399]/10 text-[#34D399]">
                {job.icon && <job.icon size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-[#CBD5E1]">
                  {job.title}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-[#64748B]">
                  {job.meta}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[12px] font-bold text-[#34D399]">
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
      <div className="flex flex-col rounded-2xl border border-white/10 bg-[#1E293B] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#64748B]">Jobs per week</Micro>
            <p className="mt-1 font-partner-display text-[30px] font-bold leading-none text-[#F8FAFC]">
              {jobsPerWeek}
              <span className="ml-1 text-[13px] font-medium text-[#64748B]">jobs</span>
            </p>
          </div>
          <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#94A3B8]">
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
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]/40 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0F172A] [&::-webkit-slider-thumb]:bg-[#34D399] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
          style={{
            background: `linear-gradient(to right, ${LIME} 0%, ${LIME} ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[#475569]">
          <span>5</span>
          <span>35</span>
        </div>

        <div className="mt-6">
          <Micro className="text-[#64748B]">Average job value</Micro>
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
                      ? 'border-[#34D399] bg-[#34D399]/10 text-[#34D399]'
                      : 'border-white/10 bg-white/[0.02] text-[#94A3B8] hover:border-white/20 hover:text-[#CBD5E1]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#34D399]/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.10),rgba(52,211,153,0.02))] p-4">
          <Micro className="text-[#94A3B8]">Estimated take-home</Micro>
          <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-partner-display text-[38px] font-bold leading-none tracking-[-0.03em] text-[#34D399]">
              {inr(net)}
            </p>
            <span className="pb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748B]">
              per month
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <Wallet size={11} className="text-[#34D399]" />
            About {inr(weekly)} paid out every Monday
          </p>
        </div>

        <p className="mt-auto pt-4 text-[11px] leading-4 text-[#64748B]">
          Illustration only, using a 15% per-job platform fee. Actual earnings depend on
          your trade, city, availability and the jobs you accept.
        </p>
      </div>

      {/* Payout preview */}
      <div className="flex flex-col rounded-2xl border border-white/10 bg-[#1E293B] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro className="text-[#64748B]">Payout preview</Micro>
            <p className="mt-2 font-partner-display text-[19px] font-bold tracking-[-0.01em] text-[#F8FAFC]">
              What lands in your account
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-md border border-[#34D399]/25 bg-[#34D399]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#34D399]">
            <CalendarCheck size={10} /> Weekly
          </span>
        </div>

        <div className="mt-6 flex h-[128px] items-end gap-2.5">
          {weekBars.map((bar, index) => (
            <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-[0.02em] text-[#94A3B8]">
                {inr(weekValues[index])}
              </span>
              <div
                className={`w-full rounded-t-[3px] transition-all duration-300 ${
                  index === 3 ? 'bg-[#34D399]' : 'bg-[#34D399]/25'
                }`}
                style={{ height: `${Math.max(10, (bar / maxBar) * 68)}px` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#475569]">
                W{index + 1}
              </span>
            </div>
          ))}
        </div>

        <dl className="mt-5 space-y-0 border-t border-white/[0.07] text-[13.5px]">
          {[
            { label: 'Gross this month', value: inr(gross), muted: true },
            { label: 'Platform fee · 15%', value: `−${inr(fee)}`, muted: true },
            { label: 'You keep', value: inr(net), strong: true },
            { label: 'Next payout · Monday', value: inr(weekly), payout: true },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-white/[0.06] py-3 last:border-b-0"
            >
              <dt
                className={
                  row.strong
                    ? 'font-semibold text-[#34D399]'
                    : row.payout
                      ? 'text-[#94A3B8]'
                      : 'text-[#94A3B8]'
                }
              >
                {row.label}
              </dt>
              <dd
                className={
                  row.strong
                    ? 'font-partner-display text-[17px] font-bold text-[#34D399]'
                    : row.payout
                      ? 'font-mono text-[13.5px] font-bold text-[#CBD5E1]'
                      : 'font-semibold text-[#CBD5E1]'
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
              <item.icon size={11} className="text-[#34D399]" />
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

  const [jobFeed, setJobFeed] = useState<
    { icon: typeof Snowflake; title: string; meta: string; value: string }[]
  >([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Fetch real job feed from backend
  useEffect(() => {
    const loadJobFeed = async () => {
      try {
        // Fetch provider's active bookings
        const bookings = await api.provider.myBookings();
        const formatted = bookings
          .slice(0, 6)
          .map((b) => {
            const svc = b.service_name || 'Service';
            const date = b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString() : 'Soon';
            const time = b.scheduled_time || '';
            return {
              icon: getIconForService(svc),
              title: svc,
              meta: `${b.distance_km || '~5'} km away · ${date}, ${time}`.trim(),
              value: b.total_amount ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(b.total_amount)}` : 'Quote',
            };
          });
        setJobFeed(formatted);
      } catch (err) {
        console.error('Failed to load job feed', err);
        // Fall back to static data on error
        setJobFeed(JOB_FEED);
      } finally {
        setLoadingFeed(false);
      }
    };

    loadJobFeed();
  }, []);
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
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#0F172A] text-[#F8FAFC]"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F172A]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-6 px-5 sm:px-8">
          <button
            type="button"
            onClick={() => scrollToId('top')}
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
            aria-label="LuckySeva Partner home"
          >
            <Logo size={36} className="rounded-lg ring-1 ring-white/10" />
            <span className="text-left">
              <span className="block text-[17px] font-extrabold leading-none tracking-tight text-[#F8FAFC]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </span>
              <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#34D399]/80">
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
                className="rounded-md px-3 py-2 text-[14px] font-semibold text-[#94A3B8] transition hover:bg-white/[0.04] hover:text-[#F8FAFC]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goToLogin}
              className="hidden h-10 items-center rounded-lg border border-white/15 px-4 text-[14px] font-bold text-[#CBD5E1] transition hover:border-white/30 hover:bg-white/[0.04] sm:flex"
            >
              Partner login
            </button>
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-[#34D399] px-4 text-[14px] font-bold text-[#0F172A] transition hover:-translate-y-0.5 hover:bg-[#D4FA6E]"
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
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(46% 52% at 76% 4%, rgba(52,211,153,0.16) 0%, transparent 66%), radial-gradient(40% 46% at 6% 30%, rgba(4,120,87,0.16) 0%, transparent 64%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(72% 64% at 60% 18%, black 0%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(72% 64% at 60% 18%, black 0%, transparent 78%)',
          }}
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
              <span className="relative inline-block">
                <span className="relative z-10 text-[#34D399]">Your earnings.</span>
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-[7px] w-full rounded-full bg-[#34D399]/20"
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
                className="group flex h-[52px] items-center justify-center gap-2 rounded-lg bg-[#34D399] px-6 text-[15px] font-bold text-[#0F172A] shadow-[0_18px_40px_-18px_rgba(52,211,153,0.75)] transition hover:-translate-y-0.5 hover:bg-[#D4FA6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]/50"
              >
                Start your application
                <ArrowRight size={16} strokeWidth={2.6} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('earnings')}
                className="flex h-[52px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 text-[15px] font-bold text-[#CBD5E1] transition hover:border-white/30 hover:bg-white/[0.06]"
              >
                Estimate earnings
                <ChevronRight size={15} />
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
                <div key={stat.label} className="bg-[#0F172A] px-3 py-3.5">
                  <p className="font-partner-display text-[17px] font-bold leading-none tracking-tight text-[#F8FAFC]">
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
            <LoginCard />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Live job ticker                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="overflow-hidden border-y border-white/[0.08] bg-[#34D399]/[0.03] py-3"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        }}
      >
        <div className="landing-marquee flex w-max items-center gap-8 whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={index} className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">
              <span className="h-1 w-1 rounded-full bg-[#34D399]" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Earnings                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section id="earnings" className="scroll-mt-[74px] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[620px]">
              <SectionLabel index="01">Earnings</SectionLabel>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#F8FAFC] sm:text-[44px]">
                Know your number
                <br className="hidden sm:block" /> before you sign up.
              </h2>
              <p className="mt-4 max-w-[480px] text-[14px] leading-7 text-[#94A3B8]">
                No hidden deductions and no haggling at the doorstep. Move the slider to
                see what a week of work could settle at.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 lg:flex">
              <ShieldCheck size={13} className="text-[#34D399]" />
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
      <section id="benefits" className="scroll-mt-[74px] border-y border-white/[0.07] bg-[#1E293B] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="max-w-[680px]">
            <SectionLabel index="02">Why partner</SectionLabel>
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#F8FAFC] sm:text-[44px]">
              Built for the way
              <br className="hidden sm:block" /> you actually work.
            </h2>
            <p className="mt-4 max-w-[520px] text-[14px] leading-7 text-[#94A3B8]">
              You have spent years learning your craft. The platform should make it easier
              to earn from it — not harder.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <div
                key={benefit.title}
                className="group flex gap-4 border-t border-white/[0.09] py-7"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-[#34D399] transition group-hover:border-[#34D399]/30 group-hover:bg-[#34D399]/[0.06]">
                  <benefit.icon size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Micro className="text-[#475569]">{String(index + 1).padStart(2, '0')}</Micro>
                    <h3 className="font-partner-display text-[16px] font-semibold tracking-[-0.01em] text-[#F8FAFC]">
                      {benefit.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#94A3B8]">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works — lime block                                        */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-[74px] bg-[#D1FAE5] py-20 text-[#064E3B] sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[600px]">
              <div className="flex items-center gap-3">
                <Micro className="text-[#047857]">03</Micro>
                <span aria-hidden className="h-px w-7 bg-[#064E3B]/25" />
                <Micro className="text-[#047857]">Onboarding</Micro>
              </div>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[46px]">
                Four steps.
                <br className="hidden sm:block" /> Usually under 48 hours.
              </h2>
            </div>
            <p className="max-w-[330px] text-[14px] leading-7 text-[#047857]">
              Most professionals finish verification in a day. Our partner desk stays on
              call while you do.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <div key={step.title} className="border-t border-[#064E3B]/25 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-partner-display text-[36px] font-bold leading-none tracking-[-0.04em] text-[#064E3B]/25">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="rounded border border-[#064E3B]/20 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#047857]">
                    {step.duration}
                  </span>
                </div>
                <h3 className="mt-6 font-partner-display text-[15px] font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[#047857]">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-[50px] items-center gap-2 rounded-lg bg-[#064E3B] px-6 text-[14px] font-bold text-[#F8FAFC] transition hover:-translate-y-0.5 hover:bg-[#065F46]"
            >
              Start your application
              <ArrowRight size={15} strokeWidth={2.6} />
            </button>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#047857]">
              <Timer size={12} /> Average application time · 4 min
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Requirements                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="requirements" className="scroll-mt-[74px] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div>
            <SectionLabel index="04">Before you start</SectionLabel>
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#F8FAFC] sm:text-[42px]">
              Bring your skill.
              <br className="hidden sm:block" /> We handle the rest.
            </h2>
            <p className="mt-4 max-w-[420px] text-[14px] leading-7 text-[#94A3B8]">
              Verification protects you as much as the customer. It is a one-time check,
              and the partner team helps you through each document.
            </p>

            <div className="mt-8 space-y-2.5">
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1E293B] px-4 py-3.5 transition hover:border-[#34D399]/30 hover:bg-[#1E293B]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34D399]/10 text-[#34D399]">
                  <PhoneCall size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#CBD5E1]">Partner desk</span>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-[0.06em] text-[#64748B]">
                    {SUPPORT_PHONE} · Mon–Sat, 9am–8pm
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#475569]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Partner%20application`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1E293B] px-4 py-3.5 transition hover:border-[#34D399]/30 hover:bg-[#1E293B]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-[#F97316]">
                  <Mail size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#CBD5E1]">Email the partner team</span>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-[0.06em] text-[#64748B]">
                    {SUPPORT_EMAIL}
                  </span>
                </span>
                <ArrowUpRight size={14} className="text-[#475569]" />
              </a>
            </div>

            <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#64748B]">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#34D399]" />
              Police verification may be requested for on-site work in some cities. We
              tell you upfront — nothing is charged for it.
            </p>
          </div>

          {/* Application checklist panel */}
          <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Micro className="text-[#64748B]">Your application</Micro>
                <p className="mt-2 font-partner-display text-[19px] font-bold tracking-[-0.01em] text-[#F8FAFC]">
                  Five things to keep ready
                </p>
              </div>
              <span className="rounded-md border border-[#34D399]/25 bg-[#34D399]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#34D399]">
                4 min
              </span>
            </div>

            <ul className="mt-5">
              {REQUIREMENTS.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-t border-white/[0.07] py-3.5 first:border-t-0 first:pt-1"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-[13px] leading-5 text-[#CBD5E1]">{item}</span>
                  <Micro className="mt-0.5 shrink-0 text-[#475569]">{String(index + 1).padStart(2, '0')}</Micro>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <Micro className="text-[#64748B]">Onboarding progress</Micro>
                <Micro className="text-[#34D399]">Step 3 of 5</Micro>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-3/5 rounded-full bg-[#34D399]" />
              </div>
            </div>

            <button
              type="button"
              onClick={goToLogin}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F8FAFC] text-[14px] font-bold text-[#0F172A] transition hover:bg-white"
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
      <section className="border-y border-white/[0.07] bg-[#1E293B] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel index="05">Partner stories</SectionLabel>
              <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#F8FAFC] sm:text-[42px]">
                What professionals
                <br className="hidden sm:block" /> tell us.
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2">
              <Star size={12} className="fill-[#34D399] text-[#34D399]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">
                4.8 average partner rating
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B] p-6"
              >
                <div className="flex items-start justify-between">
                  <Quote size={20} className="text-[#34D399]/60" />
                  <span className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star key={star} size={10} className="fill-[#34D399] text-[#34D399]" />
                    ))}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 text-[13.5px] leading-6 text-[#CBD5E1]">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34D399]/10 font-partner-display text-[13px] font-bold text-[#34D399]">
                    {testimonial.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-[#F8FAFC]">
                      {testimonial.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#64748B]">
                      {testimonial.trade}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[12px] font-bold text-[#34D399]">
                      {testimonial.earning}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#475569]">
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
            <h2 className="mt-5 font-partner-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-[#F8FAFC] sm:text-[40px]">
              Everything partners
              <br className="hidden sm:block" /> ask first.
            </h2>
            <p className="mt-4 max-w-[330px] text-[14px] leading-7 text-[#94A3B8]">
              Still unsure? The partner desk answers on call or email, six days a week.
            </p>

            <div className="mt-7 rounded-xl border border-white/10 bg-[#1E293B] p-5">
              <Micro className="text-[#64748B]">Talk to a person</Micro>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-3 transition hover:border-[#34D399]/30"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#34D399]/10 text-[#34D399]">
                  <PhoneCall size={14} />
                </span>
                <span className="flex-1">
                  <span className="block font-mono text-[13px] font-semibold tracking-[0.04em] text-[#CBD5E1]">
                    {SUPPORT_PHONE}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-[#64748B]">Mon–Sat · 9am–8pm</span>
                </span>
                <ArrowUpRight size={13} className="text-[#475569]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[#64748B] transition hover:text-[#34D399]"
              >
                <Mail size={11} /> {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="border-t border-white/[0.09]">
            {FAQS.map((faq, index) => (
              <details
                key={faq.q}
                className="group border-b border-white/[0.09] py-5"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
                  <Micro className="text-[#475569]">{String(index + 1).padStart(2, '0')}</Micro>
                  <span className="flex-1 font-partner-display text-[15px] font-semibold tracking-[-0.01em] text-[#E4EAE0]">
                    {faq.q}
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/15 text-[#94A3B8] transition group-open:rotate-45 group-open:border-[#34D399]/50 group-open:text-[#34D399]">
                    <span className="relative block h-2 w-2">
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[600px] pl-[30px] text-[13px] leading-6 text-[#94A3B8]">
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
      <section className="relative overflow-hidden bg-[#34D399] py-16 text-[#064E3B] sm:py-20">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none font-partner-display text-[20vw] font-bold leading-none tracking-[-0.06em] text-[#064E3B]/[0.035]"
        >
          PARTNER
        </span>
        <div className="relative mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <Micro className="text-[#047857]">Join the network</Micro>
          <h2 className="mt-4 max-w-[760px] font-partner-display text-[38px] font-bold leading-[0.98] tracking-[-0.04em] sm:text-[56px]">
            Your next job is
            <br className="hidden sm:block" /> already in your area.
          </h2>
          <p className="mt-4 max-w-[460px] text-[14px] leading-7 text-[#047857]">
            Create your partner account with OTP, finish verification and start receiving
            requests from the customers closest to you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-[52px] items-center justify-center gap-2 rounded-lg bg-[#064E3B] px-6 text-[14px] font-bold text-[#F8FAFC] transition hover:-translate-y-0.5 hover:bg-[#065F46]"
            >
              Apply in 4 minutes
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
              className="flex h-[52px] items-center justify-center gap-2 rounded-lg border border-[#064E3B]/25 px-5 text-[14px] font-bold text-[#064E3B] transition hover:border-[#064E3B]/50 hover:bg-[#064E3B]/5"
            >
              <PhoneCall size={14} />
              Talk to the partner team
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
            {['No joining fee', 'No monthly subscription', 'Weekly payouts'].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#047857]"
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
      <footer className="bg-[#020617] text-[#94A3B8]">
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
              <Micro className="text-[#475569]">Partner programme</Micro>
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
              <Micro className="text-[#475569]">Account</Micro>
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
              <Micro className="text-[#475569]">LuckySeva for customers</Micro>
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
