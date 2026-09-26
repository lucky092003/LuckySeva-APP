import * as Icons from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { api, setApiToken } from '@/services/api';
import { useApp, ADMIN_CREDENTIALS } from '@/context/app-context';
import { Logo } from '@/components/Logo';
import { Card, Spinner, Badge, EmptyState, Button, VerifiedBadge } from '@/components/ui';
import { inr, formatDate, slugToLabel } from '@/utils/format';
import { isVerified, kycStatus, KYC_STATUS_LABEL, kycDocLabel } from '@/utils/kyc';
import type { Booking, Professional, Category, Service } from '@/types';

const AdminHeader = ({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) => (
  <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
    <div className="flex items-center gap-3">
      <Logo size={30} />
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    {right}
  </header>
);

const Modal = ({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
      </div>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto no-scrollbar p-5">{children}</div>
    </div>
  </div>
);

export const AdminCustomers = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.bookings().then((data) => {
      setBookings(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const customers = Object.values(
    bookings.reduce<Record<string, { name: string; phone: string; count: number; spent: number; lastDate: string }>>((acc, b) => {
      const key = b.customer_phone;
      if (!acc[key]) acc[key] = { name: b.customer_name, phone: b.customer_phone, count: 0, spent: 0, lastDate: b.scheduled_date };
      acc[key].count += 1;
      if (b.status !== 'cancelled') acc[key].spent += Number(b.total_amount);
      if (b.scheduled_date > acc[key].lastDate) acc[key].lastDate = b.scheduled_date;
      return acc;
    }, {})
  ).sort((a, b) => b.spent - a.spent);

  const totalSpent = customers.reduce((s, c) => s + c.spent, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <AdminHeader
        title="Customers"
        subtitle={`${customers.length} registered customers`}
        right={
          <div className="flex gap-3 text-right">
            <div className="rounded-xl bg-gray-100 px-3 py-1.5">
              <p className="text-sm font-extrabold text-gray-900">{customers.length}</p>
              <p className="text-[10px] text-gray-500">Total</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-1.5">
              <p className="text-sm font-extrabold text-emerald-600">{inr(totalSpent)}</p>
              <p className="text-[10px] text-gray-500">Revenue</p>
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {customers.length === 0 ? (
          <EmptyState icon={<Icons.Users size={28} />} title="No customers yet" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Bookings</th>
                  <th className="px-5 py-3 font-semibold">Total Spent</th>
                  <th className="px-5 py-3 font-semibold">Last Booking</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.phone} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white">
                          {c.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-400">{c.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{c.count}</td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">{inr(c.spent)}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(c.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

export const AdminProviders = () => {
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', category: 'other', price: '149', experience: '1', serviceArea: '' });
  const [reviewing, setReviewing] = useState<Professional | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = () => {
    Promise.all([api.admin.professionals(), api.admin.categories()])
      .then(([p, c]) => {
        setPros(p || []);
        setCategories(c || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const addProvider = async () => {
    if (!form.name.trim()) return;
    setAdding(true);
    const cat = categories.find((c) => c.id === form.category);
    await api.admin
      .createProfessional({
        name: form.name.trim(),
        category_slug: cat?.slug || 'other',
        skills: [cat?.name || 'General'],
        experience_years: Number(form.experience) || 1,
        starting_price: Number(form.price) || 0,
        service_area: form.serviceArea.trim() || '',
        phone: form.phone || null,
        email: form.email.trim() || null,
      })
      .catch(() => {});
    setAdding(false);
    setShowAdd(false);
    load();
  };

  const available = pros.filter((p) => p.status === 'available').length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <AdminHeader
        title="Service Providers"
        subtitle={`${pros.length} professionals · ${available} available`}
        right={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600">
            <Icons.Plus size={14} /> Add Provider
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {pros.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center gap-3">
                <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-xl bg-gray-100 object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-gray-900">{p.name}</p>
                    {isVerified(p) && <VerifiedBadge />}
                  </div>
                  <p className="text-[11px] text-gray-500">{slugToLabel(p.category_slug)}</p>
                </div>
                <Badge tone={p.status === 'available' ? 'success' : 'warning'}>
                  {p.status === 'available' ? 'Available' : 'Busy'}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-gray-50 pt-3">
                <div className="text-center">
                  <p className="flex items-center justify-center gap-1 text-xs font-bold text-gray-900">
                    <Icons.Star size={11} className="fill-amber-400 text-amber-400" /> {p.rating}
                  </p>
                  <p className="text-[9px] text-gray-400">Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-900">{p.experience_years}y</p>
                  <p className="text-[9px] text-gray-400">Experience</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-900">{p.completed_jobs}</p>
                  <p className="text-[9px] text-gray-400">Jobs</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-emerald-600">{inr(p.starting_price)}</p>
                  <p className="text-[9px] text-gray-400">Starting</p>
                </div>
              </div>

              {/* KYC status */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                <div className="flex items-center gap-2">
                  <Icons.ShieldCheck size={15} className={kycStatus(p) === 'approved' ? 'text-emerald-500' : kycStatus(p) === 'rejected' ? 'text-red-400' : kycStatus(p) === 'pending' ? 'text-amber-500' : 'text-gray-300'} />
                  <span className="text-xs font-semibold text-gray-700">KYC: {KYC_STATUS_LABEL[kycStatus(p)]}</span>
                </div>
                {kycStatus(p) === 'pending' ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setReviewing(p); setReviewNote(''); }}
                      className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setReviewing(p); setReviewNote(''); }}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setReviewing(p); setReviewNote(p.kyc_review_note || ''); }}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-50"
                  >
                    Review
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {showAdd && (
        <Modal title="Add Service Provider" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Full name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Yadav" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Phone (optional)</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Email (optional)</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="provider@email.com" type="email" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Service area</span>
              <input value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} placeholder="e.g. Indiranagar, Bangalore" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Starting price (₹)</span>
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Experience (yrs)</span>
                <input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value.replace(/[^\d]/g, '') })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>
            <Button onClick={addProvider} disabled={adding || !form.name.trim()} className="w-full">
              {adding ? 'Adding...' : 'Add Provider'}
            </Button>
          </div>
        </Modal>
      )}

      {reviewing && (
        <Modal title={`Review KYC · ${reviewing.name}`} onClose={() => setReviewing(null)}>
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
              <p className="text-gray-900">{kycDocLabel(reviewing)} <span className="font-semibold">{reviewing.kyc_doc_number}</span></p>
              <p className="text-[11px] text-gray-500">Submitted {reviewing.kyc_submitted_at ? formatDate(reviewing.kyc_submitted_at) : '—'}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Review note (shown to provider if rejected)</span>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="e.g. Document could not be verified. Please upload a clear photo."
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={reviewSaving}
                onClick={async () => {
                  setReviewSaving(true);
                  await api.admin.reviewKyc(reviewing.id, 'rejected', reviewNote).catch(() => {});
                  setReviewSaving(false);
                  setReviewing(null);
                  load();
                }}
                className="flex-1 py-2 text-xs text-red-500"
              >
                Reject
              </Button>
              <Button
                disabled={reviewSaving}
                onClick={async () => {
                  setReviewSaving(true);
                  await api.admin.reviewKyc(reviewing.id, 'approved', reviewNote).catch(() => {});
                  setReviewSaving(false);
                  setReviewing(null);
                  load();
                }}
                className="flex-1 py-2 text-xs"
              >
                {reviewSaving ? 'Saving...' : 'Approve'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const AdminServices = () => {
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', price: '0', duration: '1 hr', popular: 'true' });

  const load = () => {
    Promise.all([api.admin.categories(), api.admin.services()])
      .then(([c, s]) => {
        setCats(c || []);
        setServices(s || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (cats.length && !form.category) setForm((f) => ({ ...f, category: cats[0].id }));
  }, [cats, form.category]);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const addService = async () => {
    if (!form.name.trim() || !form.category) return;
    setAdding(true);
    const cat = cats.find((c) => c.id === form.category);
    await api.admin
      .createService({
        name: form.name.trim(),
        category_slug: cat?.slug || '',
        description: `${form.name.trim()} service provided by verified professionals.`,
        starting_price: Number(form.price) || 0,
        estimated_duration: form.duration,
        popular: form.popular === 'true',
      })
      .catch(() => {});
    setAdding(false);
    setShowAdd(false);
    load();
  };

  const filtered = activeCat ? services.filter((s) => s.category_id === activeCat) : services;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <AdminHeader
        title="Services & Categories"
        subtitle={`${cats.length} categories · ${services.length} services`}
        right={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600">
            <Icons.Plus size={14} /> Add Service
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!activeCat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeCat === c.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold">Starting Price</th>
                <th className="px-5 py-3 font-semibold">Popular</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const cat = cats.find((c) => c.id === s.category_id);
                return (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: cat?.color || '#10b981' }}>
                          <Icons.Wrench size={16} />
                        </div>
                        <p className="font-semibold text-gray-900">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{cat?.name || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{s.estimated_duration}</td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">{inr(s.starting_price)}</td>
                    <td className="px-5 py-3">{s.popular ? <Badge tone="success">Popular</Badge> : <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {showAdd && (
        <Modal title="Add Service" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Service name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Water Heater Repair" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Starting price (₹)</span>
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-700">Est. duration</span>
                <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.popular === 'true'} onChange={(e) => setForm({ ...form, popular: e.target.checked ? 'true' : 'false' })} className="accent-emerald-500" />
              <span className="text-sm text-gray-700">Mark as popular</span>
            </label>
            <Button onClick={addService} disabled={adding || !form.name.trim()} className="w-full">
              {adding ? 'Adding...' : 'Add Service'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const { navigate } = useApp();

  useEffect(() => {
    api.admin.bookings().then((data) => {
      setBookings(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const filters = ['all', 'confirmed', 'assigned', 'on_the_way', 'started', 'completed', 'cancelled'];
  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const tone: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    confirmed: 'info', assigned: 'info', on_the_way: 'warning', started: 'warning', completed: 'success', cancelled: 'neutral',
  };
  const totalRevenue = filtered.filter((b) => b.status !== 'cancelled' && b.payment_status !== 'pending').reduce((s, b) => s + Number(b.total_amount), 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <AdminHeader
        title="All Bookings"
        subtitle={`${bookings.length} total bookings`}
        right={
          <div className="flex gap-3 text-right">
            <div className="rounded-xl bg-gray-100 px-3 py-1.5">
              <p className="text-sm font-extrabold text-gray-900">{filtered.length}</p>
              <p className="text-[10px] text-gray-500">Shown</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-1.5">
              <p className="text-sm font-extrabold text-emerald-600">{inr(totalRevenue)}</p>
              <p className="text-[10px] text-gray-500">Revenue</p>
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Icons.CalendarCheck size={28} />} title="No bookings" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3 font-semibold">Service</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Provider</th>
                  <th className="px-5 py-3 font-semibold">Schedule</th>
                  <th className="px-5 py-3 font-semibold">Payment</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-semibold text-gray-900">{b.service_name}</td>
                    <td className="px-5 py-3 text-gray-700">{b.customer_name}</td>
                    <td className="px-5 py-3 text-gray-500">{b.professional_name}</td>
                    <td className="px-5 py-3">
                      <p className="text-gray-700">{formatDate(b.scheduled_date)}</p>
                      <p className="text-[11px] text-gray-400">{b.scheduled_time}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                        {b.payment_method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">{inr(b.total_amount)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={tone[b.status]}>{b.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {b.status === 'completed' && (
                        <button
                          onClick={() => navigate({ name: 'invoice', bookingId: b.id })}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Icons.Receipt size={13} /> Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

export const AdminProfile = () => {
  const { setAdminAuthed, navigate } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<{ id: string; action: string; detail: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    { type: 'password' } | { type: 'notifications' } | { type: 'audit' } | { type: 'commission' } | { type: 'team' } | null
  >(null);
  const [pw, setPw] = useState('');
  const [commission, setCommission] = useState('10');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([api.admin.bookings(), api.admin.professionals(), api.admin.settings(), api.admin.auditLogs()])
      .then(([b, p, s, a]) => {
        setBookings(b || []);
        setPros(p || []);
        setSettings(s || {});
        setCommission((s && s.admin_commission_pct) || '10');
        setName((s && s.admin_name) || '');
        setEmail((s && s.admin_email) || '');
        setAudit((a as typeof audit) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const revenue = bookings.filter((b) => b.status !== 'cancelled' && b.payment_status !== 'pending').reduce((s, b) => s + Number(b.total_amount), 0);

  const stats = [
    { label: 'Revenue', value: inr(revenue), icon: Icons.IndianRupee, grad: 'from-emerald-500 to-teal-600' },
    { label: 'Bookings', value: `${bookings.length}`, icon: Icons.CalendarCheck, grad: 'from-sky-500 to-blue-600' },
    { label: 'Providers', value: `${pros.length}`, icon: Icons.Wrench, grad: 'from-violet-500 to-purple-600' },
    { label: 'Customers', value: `${new Set(bookings.map((b) => b.customer_phone)).size}`, icon: Icons.Users, grad: 'from-rose-500 to-pink-600' },
  ];

  const saveSetting = async (key: string, value: string, action: string, detail: string) => {
    setSaving(true);
    await api.admin.setSetting(key, value).catch(() => {});
    await api.admin.addAuditLog(action, detail).catch(() => {});
    setSaving(false);
    load();
  };

  const changePassword = () => saveSetting('admin_password', pw, 'password_change', 'Admin password changed');
  const changeCommission = () => saveSetting('admin_commission_pct', commission, 'commission_update', `Commission set to ${commission}%`);
  const changeProfile = async () => {
    await saveSetting('admin_name', name.trim(), 'profile_update', `Admin profile updated to ${name.trim()}`);
    await api.admin.setSetting('admin_email', email.trim()).catch(() => {});
    load();
  };

  const toggleNotify = async (key: string) => {
    const next = settings[key] === 'on' ? 'off' : 'on';
    await saveSetting(key, next, 'notify_toggle', `${key} turned ${next}`);
  };

  const menuItems = [
    { icon: Icons.KeyRound, label: 'Change Password', value: settings.admin_password ? '••••••' : 'Set password', desc: 'Update your admin credentials', onClick: () => setModal({ type: 'password' }) },
    { icon: Icons.Bell, label: 'Notifications', value: settings.notify_email === 'on' && settings.notify_push === 'on' ? 'Email + Push' : 'Custom', desc: 'Choose how the platform alerts you', onClick: () => setModal({ type: 'notifications' }) },
    { icon: Icons.ScrollText, label: 'Audit Log', value: `${audit.length} events`, desc: 'Track admin actions on the platform', onClick: () => setModal({ type: 'audit' }) },
    { icon: Icons.Percent, label: 'Commission & Pricing', value: `${commission}%`, desc: 'Configure platform commission tiers', onClick: () => setModal({ type: 'commission' }) },
    { icon: Icons.Users, label: 'Team & Roles', value: settings.admin_name || 'Not set', desc: 'Manage admin team members', onClick: () => setModal({ type: 'team' }) },
    { icon: Icons.HeadphonesIcon, label: 'Help & Support', value: '', desc: 'Get help with the admin console', onClick: () => { window.location.href = 'mailto:support@luckyseva.com'; } },
  ];

  const logout = async () => {
    await api.admin.addAuditLog('logout', 'Admin signed out').catch(() => {});
    setApiToken(null);
    setAdminAuthed(false);
    navigate({ name: 'admin-auth' });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <AdminHeader title="Admin Profile" subtitle="Account & platform settings" />
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xl font-bold text-white">
                  {settings.admin_name?.[0]?.toUpperCase() || '@'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-base font-bold text-gray-900">{settings.admin_name || `@${ADMIN_CREDENTIALS.username}`}</p>
                    <Icons.BadgeCheck size={16} className="shrink-0 text-emerald-500" />
                  </div>
                  <p className="text-xs text-gray-500">@{ADMIN_CREDENTIALS.username}{settings.admin_email ? ` · ${settings.admin_email}` : ''}</p>
                  <div className="mt-1.5">
                    <Badge tone="success">Administrator</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-50 pt-4">
                {stats.slice(0, 2).map((s) => (
                  <div key={s.label} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-extrabold text-gray-900">{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Button variant="outline" onClick={logout} className="w-full text-red-500">
              <Icons.LogOut size={16} /> Logout of Console
            </Button>
          </div>

          <div className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <Card key={s.label} className="p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.grad} text-white shadow-md`}>
                      <Icon size={18} />
                    </div>
                    <p className="mt-2 text-lg font-extrabold text-gray-900">{s.value}</p>
                    <p className="text-[11px] text-gray-500">{s.label}</p>
                  </Card>
                );
              })}
            </div>

            <Card className="mt-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-bold text-gray-900">Account Settings</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.label} onClick={item.onClick} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/60">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <p className="text-[11px] text-gray-400">{item.desc}</p>
                      </div>
                      {item.value && <span className="text-xs text-gray-400">{item.value}</span>}
                      <Icons.ChevronRight size={16} className="text-gray-300" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {modal?.type === 'password' && (
        <Modal title="Change Password" onClose={() => { setModal(null); setPw(''); }}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">The current admin password is validated at login.</p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">New password</span>
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter new admin password" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <Button onClick={changePassword} disabled={saving || !pw.trim()} className="w-full">{saving ? 'Saving...' : 'Update Password'}</Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'commission' && (
        <Modal title="Commission & Pricing" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Default platform commission applied to provider earnings.</p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Commission %</span>
              <div className="flex items-center gap-2">
                <input value={commission} onChange={(e) => setCommission(e.target.value.replace(/[^\d]/g, ''))} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                <span className="text-sm font-bold text-gray-700">%</span>
              </div>
            </label>
            <Button onClick={changeCommission} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Commission'}</Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'notifications' && (
        <Modal title="Notifications" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <ToggleRow label="Email notifications" value={settings.notify_email === 'off'} onChange={() => toggleNotify('notify_email')} />
            <ToggleRow label="Push notifications" value={settings.notify_push === 'off'} onChange={() => toggleNotify('notify_push')} />
          </div>
        </Modal>
      )}
      {modal?.type === 'team' && (
        <Modal title="Team & Roles" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Admin name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Admin email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <Button onClick={changeProfile} disabled={saving || !name.trim()} className="w-full">{saving ? 'Saving...' : 'Save Profile'}</Button>
            <p className="text-center text-[11px] text-gray-400">Only super admin @{ADMIN_CREDENTIALS.username} has access.</p>
          </div>
        </Modal>
      )}
      {modal?.type === 'audit' && (
        <Modal title="Audit Log" onClose={() => setModal(null)}>
          {audit.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No audit events yet.</p>
          ) : (
            <div className="space-y-2">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Icons.Activity size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900">{a.action}</p>
                    <p className="text-[11px] text-gray-500">{a.detail}</p>
                    <p className="text-[10px] text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) => (
  <div className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
    <p className="text-sm font-semibold text-gray-900">{label}</p>
    <button
      onClick={onChange}
      className={`relative h-6 w-12 rounded-full transition-colors ${value ? 'bg-gray-300' : 'bg-emerald-500'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-0.5' : 'left-[26px]'}`} />
    </button>
  </div>
);