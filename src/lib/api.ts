import type {
  Booking,
  Category,
  Notification,
  Professional,
  Profile,
  Review,
  Service,
  SupportTicket,
} from './types';

const BASE = import.meta.env.VITE_API_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const TOKEN_KEY = 'luckyseva_api_token';

export const getApiToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setApiToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(
  fn: string,
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const token = getApiToken();
  const res = await fetch(`${BASE}/${fn}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string } | null;
  if (!res.ok) throw new Error(data?.error || `API ${res.status}`);
  return data as T;
}

export const api = {
  auth: {
    verifyOtp: (input: { phone: string; code: string; role?: 'customer' | 'provider' | 'admin'; name?: string; email?: string; location?: string; profession?: string; category_slug?: string; serviceArea?: string; experience?: number | string; latitude?: number | null; longitude?: number | null; service_radius_km?: number | string }) =>
      request<{ access_token: string; role: string; professional_id?: string; profile?: Profile | null }>('auth', '/verify-otp', 'POST', input),
    me: () => request<{ role: string; profile: Profile | null; professional?: Professional }>('auth', '/me'),
  },

  catalog: {
    home: () => request<{ categories: Category[]; professionals: Professional[]; popular: Service[] }>('catalog', ''),
    categories: () => request<Category[]>('catalog', '/categories'),
    category: (slug: string) => request<{ category: Category; services: Service[] }>(`catalog`, `/categories/${slug}`),
    services: (categorySlug?: string) =>
      request<Service[]>(`catalog`, `/services${categorySlug ? `?category_slug=${encodeURIComponent(categorySlug)}` : ''}`),
    service: (id: string) => request<{ service: Service; providers: Professional[] }>('catalog', `/services/${id}`),
    professionals: (opts?: { category_slug?: string; query?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (opts?.category_slug) q.set('category_slug', opts.category_slug);
      if (opts?.query) q.set('query', opts.query);
      if (opts?.limit) q.set('limit', String(opts.limit));
      const qs = q.toString();
      return request<Professional[]>(`catalog`, `/professionals${qs ? `?${qs}` : ''}`);
    },
    professional: (id: string) =>
      request<{ professional: Professional; services: { service: Service }[]; reviews: Review[] }>('catalog', `/professionals/${id}`),
    reviews: (professionalId: string) => request<Review[]>('catalog', `/reviews/${professionalId}`),
    search: (q: string) =>
      request<{ professionals: Professional[]; services: Service[] }>(`catalog`, `/search?q=${encodeURIComponent(q)}`),
  },

  customer: {
    profile: () => request<Profile | null>('customer', '/profile'),
    updateProfile: (patch: { name?: string; email?: string; location?: string }) => request<Profile>('customer', '/profile', 'PUT', patch),
    addresses: () => request<Address[]>('customer', '/addresses'),
    addAddress: (a: { label: string; full_address: string; latitude?: number | null; longitude?: number | null }) =>
      request<Address>('customer', '/addresses', 'POST', a),
    updateAddress: (id: string, patch: { label?: string; full_address?: string; is_default?: boolean }) =>
      request<Address>('customer', `/addresses/${id}`, 'PUT', patch),
    deleteAddress: (id: string) => request<{ ok: boolean }>('customer', `/addresses/${id}`, 'DELETE'),
    bookings: () => request<Booking[]>('customer', '/bookings'),
    booking: (id: string) => request<Booking>('customer', `/bookings/${id}`),
    createBooking: (b: Partial<Booking>) => request<Booking>('customer', '/bookings', 'POST', b),
    cancelBooking: (id: string) => request<Booking>('customer', `/bookings/${id}/cancel`, 'PUT'),
    payBooking: (id: string, patch: { payment_method: string; payment_status: 'cash' | 'paid' | 'pending' }) =>
      request<Booking>('customer', `/bookings/${id}/payment`, 'PUT', patch),
    tickets: () => request<SupportTicket[]>('customer', '/tickets'),
    addTicket: (message: string) => request<SupportTicket>('customer', '/tickets', 'POST', { message }),
    favourites: () => request<Professional[]>('customer', '/favourites'),
    addFavourite: (professional_id: string) => request<Favourite>('customer', '/favourites', 'POST', { professional_id }),
    removeFavourite: (professionalId: string) => request<{ ok: boolean }>('customer', `/favourites/${professionalId}`, 'DELETE'),
    notifications: () => request<Notification[]>('customer', '/notifications'),
    markNotificationRead: (id: string) => request<Notification>('customer', `/notifications/${id}/read`, 'PUT'),
    reviews: () => request<Review[]>('customer', '/reviews'),
    addReview: (r: { booking_id?: string | null; professional_id: string; rating: number; comment?: string }) =>
      request<Review>('customer', '/reviews', 'POST', r),
  },

  provider: {
    me: () => request<{ professional: Professional; services: { service: Service }[] }>('provider', '/me'),
    updateMe: (patch: { status?: string; starting_price?: number | string; service_radius_km?: number | string; bio?: string; service_area?: string; latitude?: number; longitude?: number; name?: string }) =>
      request<Professional>('provider', '/me', 'PUT', patch),
    bookings: () => request<Booking[]>('provider', '/bookings'),
    myBookings: () => request<Booking[]>('provider', '/bookings/mine'),
    booking: (id: string) => request<Booking>('provider', `/bookings/${id}`),
    accept: (id: string) => request<Booking>('provider', `/bookings/${id}/accept`, 'POST'),
    decline: (id: string) => request<{ ok: boolean }>('provider', `/bookings/${id}/decline`, 'POST'),
    updateStatus: (id: string, status: string) =>
      request<Booking>('provider', `/bookings/${id}/status`, 'PUT', { status }),
    earnings: () => request<{ total_earnings: number; by_date: Record<string, number>; payouts: Payout[]; available: number }>('provider', '/earnings'),
    dashboard: () => request<{ active: number; completed_jobs: number; today_earnings: number; total_earnings: number }>('provider', '/dashboard'),
    requestPayout: (amount: number) => request<Payout>('provider', '/payouts', 'POST', { amount }),
    submitKyc: (input: { doc_type: string; doc_number: string }) =>
      request<Professional>('provider', '/kyc', 'PUT', input),
  },

  admin: {
    stats: () => request<{ bookings: number; customers: number; providers: number; reviews: number; today_revenue: number; recent_bookings: Booking[] }>('admin', '/stats'),
    bookings: () => request<Booking[]>('admin', '/bookings'),
    professionals: () => request<Professional[]>('admin', '/professionals'),
    categories: () => request<Category[]>('admin', '/categories'),
    services: () => request<Service[]>('admin', '/services'),
    settings: () => request<Record<string, string>>('admin', '/settings'),
    auditLogs: () => request<AuditLog[]>('admin', '/audit-logs'),
    createProfessional: (p: Record<string, unknown>) => request<Professional>('admin', '/professionals', 'POST', p),
    updateProfessional: (id: string, patch: Record<string, unknown>) => request<Professional>('admin', `/professionals/${id}`, 'PUT', patch),
    deleteProfessional: (id: string) => request<{ ok: boolean }>('admin', `/professionals/${id}`, 'DELETE'),
    createCategory: (c: Record<string, unknown>) => request<Category>('admin', '/categories', 'POST', c),
    createService: (s: Record<string, unknown>) => request<Service>('admin', '/services', 'POST', s),
    updateService: (id: string, patch: Record<string, unknown>) => request<Service>('admin', `/services/${id}`, 'PUT', patch),
    deleteService: (id: string) => request<{ ok: boolean }>('admin', `/services/${id}`, 'DELETE'),
    setSetting: (key: string, value: string) => request<{ key: string; value: string }>('admin', '/settings', 'POST', { key, value }),
    reviewKyc: (professionalId: string, decision: 'approved' | 'rejected', note?: string) =>
      request<Professional>('admin', `/kyc/${professionalId}`, 'PUT', { decision, note }),
    addAuditLog: (action: string, detail: string) => request<AuditLog>('admin', '/audit-logs', 'POST', { action, detail }),
  },
};

type Address = {
  id: string;
  customer_phone: string;
  label: string;
  full_address: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
};

type Favourite = { id: string; customer_phone: string; professional_id: string };

type Payout = { id: string; professional_id: string; amount: number; status: string; created_at: string };

type AuditLog = { id: string; action: string; detail: string; created_at: string };