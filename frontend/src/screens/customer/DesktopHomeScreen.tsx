import * as Icons from 'lucide-react';
import { SectionTitle, Spinner } from '@/components/ui';
import { formatRelativeDay, inr } from '@/utils/format';
import type { Booking, Category, Professional, Service } from '@/types';

type Props = {
  categories: Category[];
  catLoading: boolean;
  popularServices: Service[];
  svcLoading: boolean;
  topPros: Professional[];
  proLoading: boolean;
  recent: Booking[];
  name: string;
  location: string;
  locating: boolean;
  onLocationClick: () => void;
  onCategory: (slug: string) => void;
  onService: (id: string) => void;
  onBooking: (id: string) => void;
  onSeeBookings: () => void;
  onSeeServices: () => void;
  onSupport: () => void;
  onProfessional: (id: string) => void;
};

const iconFor = (name: string) =>
  (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] || Icons.Circle;

const statusTone: Record<string, string> = {
  confirmed: 'bg-sky-50 text-sky-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  on_the_way: 'bg-amber-50 text-amber-700',
  started: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-teal-50 text-teal-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

export const DesktopHomeScreen = ({
  categories,
  catLoading,
  popularServices,
  svcLoading,
  topPros,
  proLoading,
  recent,
  name,
  location,
  locating,
  onLocationClick,
  onCategory,
  onService,
  onBooking,
  onSeeBookings,
  onSeeServices,
  onSupport,
  onProfessional,
}: Props) => {
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f7f8f7]">
      <section className="border-b border-emerald-100/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_420px] items-center gap-12 px-[25px] py-9 xl:py-11">
          <div className="min-w-0">
            <button
              onClick={onLocationClick}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
            >
              <Icons.MapPin size={14} className="shrink-0 text-emerald-700" />
              <span className="truncate">{locating ? 'Detecting location…' : location || 'Choose your location'}</span>
              <Icons.ChevronDown size={13} className="shrink-0 text-slate-400" />
            </button>

            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-100">
              <Icons.Sparkles size={12} /> Trusted help for every corner of home
            </span>

            <h1 className="mt-4 max-w-2xl text-[40px] font-extrabold leading-[1.1] tracking-tight text-slate-950 xl:text-[44px]">
              A better home<br />
              starts with the <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">right help.</span>
            </h1>

            <p className="mt-4 max-w-lg text-[15px] leading-7 text-slate-500">
              Good to see you, {name}. Book verified local professionals with clear pricing and support at every step.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onSeeServices}
                className="group flex h-12 items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-900/25"
              >
                Book a service
                <Icons.ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="mt-8 flex items-center gap-7 border-t border-emerald-100/80 pt-5 text-xs text-slate-500">
              {[
                { icon: Icons.BadgeCheck, label: 'Verified professionals' },
                { icon: Icons.CreditCard, label: 'Upfront pricing' },
                { icon: Icons.ShieldCheck, label: 'Secure payments' },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-2 font-semibold">
                  <item.icon size={16} className="text-emerald-600" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative h-[300px] overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-6 shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-900/10">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-white/[0.08]" />
            <div className="absolute -bottom-28 -left-10 h-64 w-64 rounded-full bg-teal-400/20 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-50">
                    <Icons.ShieldCheck size={11} /> LuckySeva care
                  </span>
                  <p className="mt-2.5 text-xl font-bold leading-snug text-white">Your home,<br />in good hands.</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-sm"><Icons.Sparkles size={20} /></span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Icons.Wrench, label: 'Repairs' },
                  { icon: Icons.Sparkles, label: 'Cleaning' },
                  { icon: Icons.Snowflake, label: 'AC care' },
                  { icon: Icons.PaintRoller, label: 'Painting' },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                    <item.icon size={15} className="shrink-0 text-white/90" />
                    <span className="truncate text-[11px] font-semibold text-white/90">{item.label}</span>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><Icons.Home size={20} /></span>
                <span>
                  <span className="block text-xs font-bold text-white">One trusted place</span>
                  <span className="mt-0.5 block text-[10px] text-white/65">For everyday home services</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="grid w-full flex-1 grid-cols-[minmax(0,1fr)_310px] gap-8 px-[25px] py-8">
        <div className="min-w-0 space-y-8">
          <section>
            <SectionTitle title="Explore categories" action="All services" onAction={onSeeServices} />
            {catLoading ? (
              <Spinner className="py-8" />
            ) : (
              <div className="grid grid-cols-3 gap-3 xl:grid-cols-4 2xl:grid-cols-5">
                {categories.map((category) => {
                  const Icon = iconFor(category.icon);
                  return (
                    <button
                      key={category.id}
                      onClick={() => onCategory(category.slug)}
                      className="group flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${category.color}, ${category.color}cc)` }}
                      >
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">{category.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-400">{category.description || 'Explore services'}</span>
                      </span>
                      <Icons.ChevronRight size={15} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="Popular services" action="Browse services" onAction={onSeeServices} />
            {svcLoading ? (
              <Spinner className="py-8" />
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                {popularServices.slice(0, 4).map((service) => {
                  const category = categories.find((item) => item.id === service.category_id);
                  const color = category?.color || '#10b981';
                  const Icon = category ? iconFor(category.icon) : Icons.Sparkles;
                  return (
                    <button
                      key={service.id}
                      onClick={() => onService(service.id)}
                      className="group flex min-h-[128px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
                    >
                      <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}c0)` }}
                      >
                        <Icon size={25} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block line-clamp-2 text-sm font-bold leading-snug text-slate-900">{service.name}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">{service.estimated_duration}</span>
                        <span className="mt-2 block text-sm font-extrabold text-emerald-700">{inr(service.starting_price)} <span className="text-[10px] font-medium text-slate-400">onwards</span></span>
                      </span>
                      <Icons.ArrowUpRight size={17} className="shrink-0 text-slate-300 transition group-hover:text-emerald-600" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Icons.ShieldCheck size={20} /></span>
              <div>
                <p className="text-sm font-bold text-slate-800">Service you can feel good about</p>
                <p className="mt-0.5 text-xs text-slate-500">Verified professionals · Clear pricing · Support when you need it</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <SectionTitle title="Recent bookings" action="See all" onAction={onSeeBookings} />
            {recent.length ? (
              <div className="space-y-2">
                {recent.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onBooking(booking.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icons.CalendarCheck size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-800">{booking.service_name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-400">{formatRelativeDay(booking.scheduled_date)} · {booking.scheduled_time}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold capitalize ${statusTone[booking.status] || 'bg-slate-100 text-slate-600'}`}>{booking.status.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
                <Icons.CalendarDays size={21} className="mx-auto text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">No bookings yet</p>
                <p className="mt-1 text-[10px] text-slate-400">Your upcoming services will appear here.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <SectionTitle title="Top professionals" />
            {proLoading ? (
              <Spinner className="py-5" />
            ) : topPros.length ? (
              <div className="space-y-1">
                {topPros.slice(0, 5).map((professional) => {
                  const category = categories.find((item) => item.slug === professional.category_slug);
                  return (
                    <button
                      key={professional.id}
                      onClick={() => onProfessional(professional.id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: category?.color || '#059669' }}>
                        {professional.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">{professional.name}</span>
                        <span className="block truncate text-[10px] text-slate-400">{category?.name || professional.category_slug}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><Icons.Star size={12} className="fill-amber-400 text-amber-400" />{professional.rating.toFixed(1)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">Professionals will appear here soon.</p>
            )}
          </section>

          <button
            onClick={onSupport}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 p-4 text-left text-white transition hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Icons.Headphones size={19} /></span>
            <span className="flex-1">
              <span className="block text-xs font-bold">Need a hand?</span>
              <span className="mt-0.5 block text-[10px] text-white/60">Our support team is here for you.</span>
            </span>
            <Icons.ArrowRight size={16} className="text-white/60" />
          </button>
        </aside>
      </main>
    </div>
  );
};
