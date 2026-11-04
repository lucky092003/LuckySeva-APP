import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  CalendarCheck,
  Cctv,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Droplets,
  Ellipsis,
  Hammer,
  IndianRupee,
  LockKeyhole,
  Mail,
  MapPin,
  PaintRoller,
  PhoneCall,
  Quote,
  Scissors,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Trees,
  Truck,
  UserCheck,
  WashingMachine,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useApp } from '@/context/app-context';
import { PARTNER_SITE_URL } from '@/config/site-links';
import { api, type LandingData } from '@/services/api';

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
// The customer site is deliberately warm and editorial: ivory paper, a
// forest-green ink and the brand orange used as a single accent. It shares
// no palette, type or section order with the partner site.

const SUPPORT_PHONE = '1800-200-9876';
const SUPPORT_EMAIL = 'support@luckyseva.com';
const DEMO_PHONE = '9876543210';

type IconType = typeof Sparkles;

/* ------------------------------------------------------------------ */
/* Service cards: identity (icon + photo) is local, facts come from the DB */
/* ------------------------------------------------------------------ */
// Keyed by the category slug stored in the database. Copy and prices shown on
// the cards are NOT defined here - they are read from the live catalogue, so
// the page can never advertise a price the app does not charge.
const VISUALS: Record<string, { icon: IconType; blurb: string }> = {
  electrician: { icon: Zap, blurb: 'Wiring, sockets, fans and safety checks' },
  plumber: { icon: Droplets, blurb: 'Leaks, taps, pipes and bathroom fittings' },
  'ac-repair': { icon: Snowflake, blurb: 'Service, gas refill and installation' },
  cleaning: { icon: Sparkles, blurb: 'Home, kitchen and bathroom deep clean' },
  carpenter: { icon: Hammer, blurb: 'Furniture, doors and custom woodwork' },
  painting: { icon: PaintRoller, blurb: 'Interior, exterior and texture finishes' },
  'appliance-repair': { icon: WashingMachine, blurb: 'Fridge, washing machine and geyser' },
  'beauty-salon': { icon: Scissors, blurb: 'Salon-grade care at home' },
  'pest-control': { icon: Bug, blurb: 'Safe, targeted pest treatment' },
  physiotherapy: { icon: Activity, blurb: 'Recovery and mobility at home' },
  'packer-mover': { icon: Truck, blurb: 'Local and intercity shifting' },
  'cctv-security': { icon: Cctv, blurb: 'Cameras, access and smart security' },
  'laundry-dry-cleaning': { icon: Shirt, blurb: 'Wash, fold, iron and dry clean' },
  'lawn-garden': { icon: Trees, blurb: 'Lawn care and garden makeovers' },
  other: { icon: Ellipsis, blurb: 'Tell us what your home needs' },
};

type ServiceCard = {
  slug: string;
  name: string;
  desc: string;
  icon: IconType;
  price: number | null;
  popular: boolean;
};

// Shown only when the API cannot be reached at all (offline, backend asleep),
// so the page still presents every service. No price or "popular" claim is made
// here - those appear only once the live catalogue answers.
const FALLBACK_NAMES: Record<string, string> = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  'ac-repair': 'AC Repair',
  cleaning: 'Cleaning',
  carpenter: 'Carpenter',
  painting: 'Painting',
  'appliance-repair': 'Appliance Repair',
  'beauty-salon': 'Beauty & Salon',
  'pest-control': 'Pest Control',
  physiotherapy: 'Physiotherapy',
  'packer-mover': 'Packer & Mover',
  'cctv-security': 'CCTV & Security',
  'laundry-dry-cleaning': 'Laundry & Dry Cleaning',
  'lawn-garden': 'Lawn & Garden',
  other: 'Other Services',
};

const toCards = (data: LandingData | null): ServiceCard[] => {
  const rows: LandingData['categories'] = data
    ? data.categories
    : Object.keys(FALLBACK_NAMES).map((slug) => ({
        slug,
        name: FALLBACK_NAMES[slug],
        description: '',
        starting_price: null,
        popular: false,
        services_count: 0,
      }));
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    desc: c.description || VISUALS[c.slug]?.blurb || '',
    icon: VISUALS[c.slug]?.icon ?? Sparkles,
    price: c.starting_price,
    popular: c.popular,
  }));
};

// Local, bundled photos (src/assets/services/<category-slug>.jpg) so the cards
// never break when a third-party host changes or goes down.
const SERVICE_PHOTOS = import.meta.glob('@/assets/services/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const serviceImage = (slug: string) => {
  const key = Object.keys(SERVICE_PHOTOS).find((path) => path.endsWith(`/${slug}.jpg`));
  return key ? SERVICE_PHOTOS[key] : undefined;
};

/** 1,284 -> "1,280+", 37 -> "37". Never rounds up, so a figure is never overstated. */
const formatCount = (n: number) => {
  if (n < 50) return String(n);
  const step = n >= 1000 ? 100 : 10;
  return `${(Math.floor(n / step) * step).toLocaleString('en-IN')}+`;
};

const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const useLandingData = () => {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Prefer the one-shot landing endpoint. If the deployed backend predates it,
    // rebuild the same category/price facts from the long-standing catalogue
    // endpoints so prices are still the real ones.
    const fromCatalogue = async (): Promise<LandingData> => {
      const [categories, services] = await Promise.all([api.catalog.categories(), api.catalog.services()]);
      const rows = categories.map((c) => {
        const own = services.filter((svc) => svc.category_id === c.id);
        const prices = own.map((svc) => Number(svc.starting_price)).filter((n) => n > 0);
        return {
          slug: c.slug,
          name: c.name,
          description: c.description,
          starting_price: prices.length ? Math.min(...prices) : null,
          popular: own.some((svc) => svc.popular),
          services_count: own.length,
        };
      });
      return {
        stats: {
          categories: rows.filter((r) => r.services_count > 0).length,
          services: services.length,
          professionals: 0,
          completed_bookings: 0,
          reviews: 0,
          rating_avg: null,
          cities: 0,
        },
        categories: rows,
        testimonials: [],
        cities: [],
      };
    };

    api.catalog
      .landing()
      .catch(fromCatalogue)
      .then((res) => alive && setData(res))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading };
};

const STANDARDS: { icon: IconType; title: string; body: string }[] = [
  { icon: UserCheck, title: 'Background-checked, every time', body: 'Every professional clears a government-ID check, a trade assessment and a background verification before they wear the LuckySeva badge.' },
  { icon: IndianRupee, title: 'The price you see is the price you pay', body: 'Your quote is agreed before the visit. If the job changes, you approve the difference in the app - never at the doorstep.' },
  { icon: MapPin, title: 'Live tracking, not a vague window', body: 'Follow your professional from the moment they accept the job, with an arrival estimate that updates as they travel.' },
  { icon: ShieldCheck, title: '30 days of cover after the job', body: 'If something is not right, raise it from the booking within 30 days. Our support team resolves it - no arguing, no chasing.' },
];

const STEPS: { title: string; body: string }[] = [
  { title: 'Choose the service', body: 'Browse every category with clear starting prices before you commit.' },
  { title: 'Pick a slot', body: 'Choose a day and time that suits your home.' },
  { title: 'Track them in', body: 'Watch your verified professional arrive on the live map.' },
  { title: 'Pay after the work', body: 'Pay by UPI, card or cash - with a digital invoice saved for you.' },
];

const FAQS = [
  { q: 'Are the professionals verified?', a: 'Yes. Every professional is background-verified, trade-tested and government-ID checked before onboarding. Their profile shows their rating and completed jobs.' },
  { q: 'How does pricing work?', a: 'Every service has an upfront starting price. You see the total before confirming, and any additional work is approved by you in the app before it is billed.' },
  { q: 'Can I cancel or reschedule?', a: 'You can cancel from My Bookings. To move a service to another day, cancel the existing booking and rebook the slot that suits you.' },
  { q: 'What if I am not satisfied?', a: 'Every booking carries a 30-day service warranty. Raise the issue from the booking details and the support team will resolve it within 24 hours.' },
  { q: 'How do I pay?', a: 'Pay online with UPI, cards or net banking, or pay cash once the service is complete. A digital invoice is available for every booking.' },
];

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

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

const Stars = ({ size = 12, value = 5 }: { size?: number; value?: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
    {[0, 1, 2, 3, 4].map((star) => (
      <Star
        key={star}
        size={size}
        className={star < Math.round(value) ? 'fill-[#F97316] text-[#F97316]' : 'fill-transparent text-[#94A3B8]/60'}
      />
    ))}
  </span>
);

/* ------------------------------------------------------------------ */
/* Customer login card                                                 */
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
    navigate({ name: 'auth', phone });
  };

  return (
    <div className="relative w-full">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[36px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(5,150,105,0.12),transparent_70%)]"
      />

      <div className="relative overflow-hidden rounded-[26px] border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_36px_80px_-42px_rgba(15,23,42,0.5)]">
        <div aria-hidden className="h-1.5 bg-[linear-gradient(90deg,#059669_0%,#F97316_45%,#059669_100%)]" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <Logo size={42} className="rounded-xl shadow-sm ring-1 ring-[#0F172A]/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                Customer account
              </p>
            </div>
            <span className="rounded-full border border-[#E8D9C6] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#047857]">
              Login demo
            </span>
          </div>

          <div className="mt-6">
            <h2 className="font-customer-display text-[34px] leading-[1.05] tracking-[-0.01em] text-[#0F172A]">
              Welcome home.
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748B]">
              Sign in with your mobile number and book a verified professional in under a minute.
            </p>
          </div>

          <form onSubmit={submit} className="mt-5">
            <label htmlFor="customer-landing-phone" className="text-[13.5px] font-bold text-[#334155]">
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
                id="customer-landing-phone"
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
              <p className="mt-1.5 text-[13px] font-semibold text-[#059669]">
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

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#94A3B8]">
                <LockKeyhole size={11} /> Secure OTP sign-in
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhone(DEMO_PHONE);
                  setTouched(false);
                }}
                className="text-[12px] font-bold text-[#059669] underline-offset-2 hover:underline"
              >
                Reset demo number
              </button>
            </div>
          </form>

          <p className="mt-5 border-t border-[#E2E8F0] pt-4 text-[12px] leading-5 text-[#9A8B7A]">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
          <p className="mt-1 text-center">
            <a
              href={PARTNER_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#94A3B8] underline decoration-[#CBD5E1] underline-offset-2 transition hover:text-[#059669]"
            >
              Are you a professional? Partner sign-in
              <ArrowUpRight size={10} strokeWidth={2.5} />
            </a>
          </p>
        </div>
      </div>

    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export const LandingScreen = () => {
  const { navigate } = useApp();
  const { data } = useLandingData();

  const goToLogin = () => navigate({ name: 'auth' });

  const cards = toCards(data);
  const stats = data?.stats;
  const testimonials = data?.testimonials ?? [];
  const cities = data?.cities ?? [];
  const hasRating = !!stats && stats.reviews > 0 && stats.rating_avg !== null;

  // Only facts the database can back up. A figure that is zero is left out
  // rather than shown as "0+", so a young marketplace still looks honest.
  const statItems = [
    stats && stats.services > 0 && { value: formatCount(stats.services), label: 'Services on demand' },
    stats && stats.completed_bookings > 0 && { value: formatCount(stats.completed_bookings), label: 'Jobs completed' },
    stats && stats.professionals > 0 && { value: formatCount(stats.professionals), label: 'Verified professionals' },
    hasRating && { value: `${stats!.rating_avg!.toFixed(1)}/5`, label: 'Average rating' },
  ].filter(Boolean) as { value: string; label: string }[];

  const navItems = [
    { label: 'Services', id: 'services' },
    { label: 'The standard', id: 'standard' },
    { label: 'How it works', id: 'how-it-works' },
    ...(testimonials.length > 0 ? [{ label: 'Reviews', id: 'reviews' }] : []),
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
            aria-label="LuckySeva home"
          >
            <Logo size={38} className="rounded-xl shadow-sm ring-1 ring-[#0F172A]/10" />
            <span className="text-left">
              <span className="block text-[18px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                Lucky<span className="text-[#F97316]">Seva</span>
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
                For your home
              </span>
            </span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToId(item.id)}
                className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goToLogin}
              className="hidden h-10 items-center rounded-full border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-[14px] font-bold text-[#334155] transition hover:border-[#059669] hover:text-[#0F172A] sm:flex"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={goToLogin}
              className="flex h-10 items-center gap-2 rounded-full bg-[#0F172A] px-4 text-[14px] font-bold text-[#FFFFFF] transition hover:-translate-y-0.5 hover:bg-[#12402F]"
            >
              Book a service
              <ArrowUpRight size={14} strokeWidth={2.5} className="text-[#F59E0B]" />
            </button>
          </div>
        </div>
      </header>

      <div id="top" />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-[#0F172A]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(52% 46% at 82% 8%, rgba(5,150,105,0.22) 0%, transparent 65%), radial-gradient(46% 50% at 4% 22%, rgba(249,115,22,0.14) 0%, transparent 62%)',
          }}
        />
        <div className="relative mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] items-center gap-12 px-4 pb-12 pt-10 sm:px-8 sm:pb-14 sm:pt-12 2xl:pb-28 2xl:pt-24 lg:grid-cols-[minmax(0,1.06fr)_minmax(360px,404px)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(400px,440px)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div className="landing-rise min-w-0">
            <div className="flex items-center gap-3">
              <span className="h-px w-9 bg-[#34D399]" />
              <span className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
                Verified home services
              </span>
            </div>

            <h1 className="mt-6 font-customer-display text-[54px] leading-[0.94] tracking-[-0.025em] text-[#F8FAFC] sm:text-[72px] xl:text-[80px] 2xl:text-[96px]">
              The people
              <br />
              your home
              <br />
              <span className="relative inline-block italic text-[#34D399]">
                deserves.
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

            <p className="mt-7 max-w-[520px] text-[17px] leading-8 text-[#CBD5E1]">
              From a leaking tap to a full home makeover — book background-checked
              professionals with an upfront price, live tracking and a 30-day service
              warranty.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={goToLogin}
                className="group flex h-[54px] items-center justify-center gap-2 rounded-full bg-[#059669] px-7 text-[15px] font-bold text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20"
              >
                Book a service
                <ArrowRight size={17} strokeWidth={2.5} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('services')}
                className="flex h-[54px] items-center justify-center gap-2 rounded-full border border-[#334155] bg-[#1E293B]/70 px-6 text-[15px] font-bold text-[#F8FAFC] backdrop-blur-sm transition hover:border-[#34D399] hover:bg-[#1E293B]"
              >
                {stats && stats.services > 0 ? `Browse ${formatCount(stats.services)} services` : 'Browse services'}
                <ChevronRight size={16} />
              </button>
            </div>

            {hasRating && (
              <div className="mt-10 flex items-center gap-3">
                <Stars value={stats!.rating_avg!} />
                <span className="text-[13.5px] font-extrabold text-[#F8FAFC]">
                  {stats!.rating_avg!.toFixed(1)} out of 5
                </span>
                <span className="text-[12px] text-[#94A3B8]">
                  from {stats!.reviews.toLocaleString('en-IN')} verified {stats!.reviews === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>

          <div
            className="landing-rise relative w-full max-w-[404px] 2xl:max-w-[440px] justify-self-center lg:justify-self-end"
            style={{ animationDelay: '120ms' }}
          >
            <LoginCard />
          </div>
        </div>
        {/* Cities that real professionals serve */}
        {cities.length > 1 && (
          <div className="overflow-hidden border-y border-[#E2E8F0] bg-[#F8FAFC] py-4">
            <div className="landing-marquee flex w-max items-center gap-10 whitespace-nowrap">
              {[...cities, ...cities, ...cities, ...cities].map((city, index) => (
                <span key={index} className="flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
                  <span className="h-1 w-1 rounded-full bg-[#059669]" />
                  {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live numbers */}
        {statItems.length > 0 && (
          <div className="relative border-t border-[#E2E8F0] bg-[#FFFFFF]">
            <div className={`mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] grid-cols-2 px-5 sm:px-8 ${statItems.length >= 4 ? 'sm:grid-cols-4' : statItems.length === 3 ? 'sm:grid-cols-3' : ''}`}>
              {statItems.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`px-1 py-5 sm:px-6 sm:py-6 ${index > 0 ? 'sm:border-l sm:border-[#E2E8F0]' : ''}`}
                >
                  <p className="font-customer-display text-[30px] leading-none tracking-tight text-[#0F172A] sm:text-[34px]">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748B]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Services                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section id="services" className="scroll-mt-[74px] relative overflow-hidden bg-[#F8FAFC] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(15,23,42,0.06) 0.7px, transparent 0.7px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[640px]">
              <SectionLabel index="01">Services</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[40px] leading-[1.0] tracking-[-0.025em] text-[#0F172A] sm:text-[52px]">
                Everything a home needs,
                <br className="hidden sm:block" /> in one considered place.
              </h2>
            </div>
            <p className="max-w-[360px] text-[15px] leading-7 text-[#64748B]">
              {stats && stats.services > 0
                ? `${stats.categories} categories and ${stats.services} services, each with a clear starting price. `
                : 'Every service comes with a clear starting price. '}
              Every professional is verified, rated and ready before their first job.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={goToLogin}
                className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl sm:min-h-[240px] 2xl:min-h-[280px] bg-[#0F172A] p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-18px_rgba(15,23,42,0.35)] ring-1 ring-[#0F172A]/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-24px_rgba(15,23,42,0.45)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] sm:p-6 ${
                  category.slug === 'other' ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : ''
                }`}
              >
                <div aria-hidden="true" className="absolute inset-0">
                  <img
                    src={serviceImage(category.slug)}
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
                    {category.name}
                  </span>
                  {category.price ? (
                    <span className="shrink-0 text-[13px] font-semibold text-white/85">
                      from {formatPrice(category.price)}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          {/* AI matching banner */}
          <div className="relative mt-8 overflow-hidden rounded-3xl bg-[#0F172A] px-6 py-7 text-[#F1F5F9] sm:px-9">
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#F1F5F9]/15 bg-[#F1F5F9]/10 text-[#F59E0B]">
                  <Sparkles size={19} />
                </span>
                <div>
                  <p className="font-customer-display text-[24px] leading-tight tracking-tight sm:text-[26px]">
                    Not sure what the problem is? Just describe it.
                  </p>
                  <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-6 text-[#94A3B8]">
                    Our assistant reads plain language and matches you to the right service,
                    professional and price — no catalogue scrolling.
                  </p>
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 rounded-2xl border border-[#F1F5F9]/15 bg-[#0F172A] p-1.5 lg:w-[360px]">
                <span className="flex-1 truncate px-3 text-[13px] text-[#94A3B8]">
                  &ldquo;water leaking under the kitchen sink&rdquo;
                </span>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#EA580C] px-3.5 text-[13px] font-bold text-white transition hover:bg-[#059669]"
                >
                  Find my pro
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-5 flex items-center gap-2 text-[12px] font-medium text-[#94A3B8]">
            <LockKeyhole size={12} /> Sign in to see live availability and exact pricing near you.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The standard                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="standard" className="scroll-mt-[74px] border-y border-[#E2E8F0] bg-[#F1F5F9] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionLabel index="02">The standard</SectionLabel>
            <h2 className="mt-5 font-customer-display text-[38px] leading-[1.02] tracking-[-0.02em] text-[#0F172A] sm:text-[46px]">
              Trust is not a
              <br className="hidden sm:block" /> tagline. It is
              <br className="hidden sm:block" /> the product.
            </h2>
            <p className="mt-5 max-w-[360px] text-[15px] leading-7 text-[#475569]">
              Four commitments we make on every booking, in every city we serve. No
              exceptions for busy days.
            </p>

            <div className="mt-8 flex items-center gap-5">
              <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-full border border-[#CBD5E1]">
                <div className="flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full border border-[#CBD5E1]/70 text-center">
                  <ShieldCheck size={15} className="text-[#059669]" />
                  <span className="font-customer-display text-[22px] leading-none text-[#0F172A]">30</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    day cover
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[13.5px] font-extrabold text-[#0F172A]">
                  The LuckySeva guarantee
                </p>
                <p className="mt-1 max-w-[190px] text-[12px] leading-5 text-[#64748B]">
                  If a job is not right, we return and fix it. Covered for 30 days.
                </p>
              </div>
            </div>
          </div>

          <div>
            {STANDARDS.map((standard, index) => (
              <div
                key={standard.title}
                className="group grid grid-cols-[36px_minmax(0,1fr)_34px] items-start gap-4 border-t border-[#CBD5E1] py-7 transition first:border-t-0 first:pt-0 sm:gap-6 sm:py-8"
              >
                <span className="pt-1 text-[12px] font-bold tracking-[0.16em] text-[#94A3B8]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-customer-display text-[25px] leading-tight tracking-[-0.01em] text-[#0F172A] sm:text-[29px]">
                    {standard.title}
                  </h3>
                  <p className="mt-2 max-w-[520px] text-[13.5px] leading-6 text-[#475569]">
                    {standard.body}
                  </p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#CBD5E1] bg-[#FFFFFF]/60 text-[#059669] transition group-hover:border-[#059669]/30 group-hover:bg-[#FFFFFF]">
                  <standard.icon size={15} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-[74px] bg-[#FFFFFF] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[600px]">
              <SectionLabel index="03">How it works</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[38px] leading-[1.02] tracking-[-0.02em] text-[#0F172A] sm:text-[48px]">
                Booked in minutes.
                <br className="hidden sm:block" /> Done properly.
              </h2>
            </div>
            <p className="max-w-[330px] text-[14px] leading-7 text-[#64748B]">
              No phone calls, no price haggling, no waiting around all day. A clear,
              tracked experience from start to finish.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative border-t border-[#CBD5E1] pt-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-customer-display text-[38px] leading-none text-[#059669]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {index < STEPS.length - 1 && (
                    <ArrowRight size={15} className="hidden text-[#CBD5E1] lg:block" />
                  )}
                </div>
                <h3 className="mt-6 text-[15px] font-extrabold tracking-tight text-[#0F172A]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[#64748B]">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#334155]">
              <CalendarCheck size={15} className="text-[#059669]" />
              {cities.length > 0 ? `Serving ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ` and ${cities.length - 3} more` : ''}.` : 'Book a slot that suits your home.'}
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#059669] underline-offset-4 hover:underline"
            >
              Check availability in your area <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Reviews                                                          */}
      {/* ---------------------------------------------------------------- */}
      {testimonials.length > 0 && (
      <section id="reviews" className="scroll-mt-[74px] border-t border-[#E2E8F0] bg-[#F1F5F9] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel index="04">Reviews</SectionLabel>
              <h2 className="mt-5 font-customer-display text-[38px] leading-[1.02] tracking-[-0.02em] text-[#0F172A] sm:text-[46px]">
                What customers
                <span className="italic text-[#059669]"> say.</span>
              </h2>
            </div>
            {hasRating && (
              <div className="flex items-center gap-3 rounded-full border border-[#CBD5E1] bg-[#FFFFFF]/70 px-4 py-2">
                <Stars size={13} value={stats!.rating_avg!} />
                <span className="text-[13px] font-bold text-[#0F172A]">{stats!.rating_avg!.toFixed(1)} / 5</span>
                <span className="h-3 w-px bg-[#CBD5E1]" />
                <span className="text-[12px] font-medium text-[#64748B]">
                  {stats!.reviews.toLocaleString('en-IN')} verified {stats!.reviews === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>

          <div className={`mt-10 grid gap-4 ${testimonials.length > 1 ? 'lg:grid-cols-[1.18fr_0.82fr]' : ''}`}>
            <figure className="relative overflow-hidden rounded-3xl bg-[#0F172A] p-7 text-[#F1F5F9] sm:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#EA580C]/20 blur-3xl"
              />
              <Quote size={30} className="relative text-[#F59E0B]" />
              <blockquote className="relative mt-5 font-customer-display text-[29px] leading-[1.18] tracking-[-0.01em] sm:text-[36px]">
                &ldquo;{testimonials[0].comment}&rdquo;
              </blockquote>
              <figcaption className="relative mt-8 flex items-center gap-3 border-t border-[#F1F5F9]/15 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9] text-[14px] font-extrabold text-[#0F172A]">
                  {testimonials[0].name.charAt(0)}
                </span>
                <span className="flex-1">
                  <span className="block text-[14px] font-extrabold">{testimonials[0].name}</span>
                  {testimonials[0].service && (
                    <span className="mt-0.5 block text-[12px] text-[#94A3B8]">{testimonials[0].service}</span>
                  )}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-[#F1F5F9]/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#D1FAE5]">
                  <BadgeCheck size={11} /> Verified
                </span>
              </figcaption>
            </figure>

            {testimonials.length > 1 && (
              <div className="grid gap-4">
                {testimonials.slice(1).map((testimonial) => (
                  <figure
                    key={`${testimonial.name}-${testimonial.comment.slice(0, 12)}`}
                    className="flex flex-col rounded-3xl border border-[#CBD5E1] bg-[#FFFFFF] p-6"
                  >
                    <Stars size={11} value={testimonial.rating} />
                    <blockquote className="mt-3 flex-1 text-[14px] leading-6 text-[#475569]">
                      &ldquo;{testimonial.comment}&rdquo;
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-2.5 border-t border-[#E2E8F0] pt-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[12px] font-extrabold text-[#0F172A]">
                        {testimonial.name.charAt(0)}
                      </span>
                      <span>
                        <span className="block text-[13px] font-extrabold text-[#0F172A]">{testimonial.name}</span>
                        {testimonial.service && (
                          <span className="block text-[11px] text-[#64748B]">{testimonial.service}</span>
                        )}
                      </span>
                      <BadgeCheck size={14} className="ml-auto text-[#059669]" />
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* FAQ                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#FFFFFF] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1240px] 2xl:max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionLabel index="05">Questions</SectionLabel>
            <h2 className="mt-5 font-customer-display text-[38px] leading-[1.02] tracking-[-0.02em] text-[#0F172A] sm:text-[44px]">
              Everything you
              <br className="hidden sm:block" /> want to know first.
            </h2>
            <p className="mt-4 max-w-[330px] text-[14px] leading-7 text-[#64748B]">
              Still unsure? A real person is a call or an email away, seven days a week.
            </p>

            <div className="mt-7 space-y-2.5">
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] text-[#F1F5F9]">
                  <PhoneCall size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">Call support</span>
                  <span className="mt-0.5 block text-[12px] text-[#94A3B8]">{SUPPORT_PHONE}</span>
                </span>
                <ArrowUpRight size={15} className="text-[#94A3B8]" />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3.5 transition hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9] text-[#059669]">
                  <Mail size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0F172A]">Email support</span>
                  <span className="mt-0.5 block text-[12px] text-[#94A3B8]">{SUPPORT_EMAIL}</span>
                </span>
                <ArrowUpRight size={15} className="text-[#94A3B8]" />
              </a>
            </div>
          </div>

          <div className="border-t border-[#E2E8F0]">
            {FAQS.map((faq, index) => (
              <details
                key={faq.q}
                className="group border-b border-[#E2E8F0] py-5"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 text-left [&::-webkit-details-marker]:hidden">
                  <span className="text-[11px] font-bold tracking-[0.16em] text-[#94A3B8]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-[15px] font-extrabold tracking-tight text-[#0F172A]">
                    {faq.q}
                  </span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#CBD5E1] text-[#64748B] transition group-open:rotate-45 group-open:border-[#059669] group-open:text-[#059669]">
                    <span className="relative block h-2.5 w-2.5">
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[560px] pl-[30px] text-[13.5px] leading-6 text-[#475569]">
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
      <section className="bg-[#FFFFFF] px-5 pb-20 sm:px-8">
        <div className="relative mx-auto max-w-[1240px] 2xl:max-w-[1440px] overflow-hidden rounded-[34px] bg-[#0F172A] px-6 py-14 text-center text-[#F1F5F9] sm:px-10 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(48% 70% at 18% 0%, rgba(5,150,105,0.26) 0%, transparent 60%), radial-gradient(46% 60% at 88% 100%, rgba(16,185,129,0.18) 0%, transparent 65%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #F1F5F9 1px, transparent 1px), linear-gradient(to bottom, #F1F5F9 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F1F5F9]/20 bg-[#F1F5F9]/5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#D1FAE5]">
              <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              Book in minutes
            </span>
            <h2 className="mx-auto mt-6 max-w-[720px] font-customer-display text-[38px] leading-[1.02] tracking-[-0.02em] sm:text-[54px]">
              Your home deserves
              <br className="hidden sm:block" /> a better kind of help.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[14px] leading-7 text-[#94A3B8]">
              A verified professional, an agreed price and a warranty behind every job.
              Book your first service in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goToLogin}
                className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#EA580C] px-7 text-[15px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#059669] sm:w-auto"
              >
                Book your first service
                <ArrowRight size={16} strokeWidth={2.5} className="transition group-hover:translate-x-0.5" />
              </button>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[#F1F5F9]/25 px-6 text-[14px] font-bold text-[#F1F5F9] transition hover:border-[#F1F5F9]/40 hover:bg-[#F1F5F9]/5 sm:w-auto"
              >
                <PhoneCall size={15} />
                {SUPPORT_PHONE}
              </a>
            </div>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-[#94A3B8]">
              {['No hidden charges', 'Verified professionals', '30-day warranty'].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check size={11} className="text-[#F59E0B]" strokeWidth={3} />
                  {item}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-[#F1F5F9]/10 bg-[#0F172A] text-[#94A3B8]">
        <div className="mx-auto w-full max-w-[1240px] 2xl:max-w-[1440px] px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_0.9fr_0.9fr]">
            <div>
              <div className="flex items-center gap-3">
                <Logo size={38} className="rounded-xl ring-1 ring-[#F1F5F9]/10" />
                <span className="text-[18px] font-extrabold tracking-tight text-[#F1F5F9]">
                  Lucky<span className="text-[#F97316]">Seva</span>
                </span>
                <span className="rounded-full border border-[#F1F5F9]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                  For homes
                </span>
              </div>
              <p className="mt-4 max-w-[320px] text-[13px] leading-6 text-[#64748B]">
                Verified home services with upfront pricing, live tracking and real human
                support. One trusted name for every home need.
              </p>
              <p className="mt-5 text-[12px] font-semibold text-[#94A3B8]">www.luckyseva.in</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {['UPI', 'Cards', 'Net banking', 'Cash'].map((method) => (
                  <span
                    key={method}
                    className="rounded-md border border-[#F1F5F9]/10 bg-[#F1F5F9]/[0.03] px-2 py-1 text-[11px] font-semibold text-[#64748B]"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#64748B]">
                Explore
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToId(item.id)}
                      className="transition hover:text-[#F1F5F9]"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={goToLogin}
                    className="transition hover:text-[#F1F5F9]"
                  >
                    Book a service
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#64748B]">
                Support
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <a
                    href={`tel:${SUPPORT_PHONE.replace(/-/g, '')}`}
                    className="flex items-center gap-2 transition hover:text-[#F1F5F9]"
                  >
                    <PhoneCall size={12} /> {SUPPORT_PHONE}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center gap-2 transition hover:text-[#F1F5F9]"
                  >
                    <Mail size={12} /> {SUPPORT_EMAIL}
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToId('how-it-works')}
                    className="transition hover:text-[#F1F5F9]"
                  >
                    Cancellations
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToId('standard')}
                    className="transition hover:text-[#F1F5F9]"
                  >
                    Service warranty
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-[#F1F5F9]/10 pt-6 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <p>— 2026 LuckySeva. All rights reserved.</p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={11} /> Verified professionals
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={11} /> 7 days a week
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard size={11} /> Secure payments
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
