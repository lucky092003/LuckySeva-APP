import type {
  Booking,
  Category,
  Notification,
  Payout,
  Professional,
  Profile,
  Refund,
  Review,
  Service,
  SupportTicket,
} from '@/types';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const MISSING_BASE =
  'VITE_API_URL is not set. Set it in the Vercel project environment variables to your Render backend URL.';

const TOKEN_KEY = 'luckyseva_api_token';

export const getApiToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setApiToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

/** Keeps the HTTP status and the backend's stable error code so callers can branch on them. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  fn: string,
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  if (!BASE) {
    console.error(MISSING_BASE);
    throw new ApiError(MISSING_BASE, 0);
  }
  const token = getApiToken();
  const res = await fetch(`${BASE}/${fn}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) throw new ApiError(data?.error || `API ${res.status}`, res.status, data?.code);
  return data as T;
}

const STALE_BACKEND_HINT =
  'This backend is too old to send OTPs. Run the backend from backend/ (python -m uvicorn app.main:app --port 8001) or redeploy it.';

export const otpErrorMessage = (e: unknown, fallback: string): string => {
  if (!(e instanceof Error)) return fallback;
  return /API 404/.test(e.message) ? STALE_BACKEND_HINT : e.message;
};

/** True when the backend refuses a login because the number is not on file yet. */
export const isSignupRequired = (e: unknown): boolean =>
  e instanceof ApiError && e.code === 'signup_required';

export const api = {
  auth: {
    requestOtp: (input: { phone: string; role?: 'customer' | 'provider'; mode?: 'login' | 'signup' }) =>
      request<{ sent: boolean; role: string; expires_in: number; resend_after: number; debug_code?: string }>(
        'auth',
        '/request-otp',
        'POST',
        input
      ),
    verifyOtp: (input: { phone: string; code: string; role?: 'customer' | 'provider' | 'admin'; mode?: 'login' | 'signup'; name?: string; email?: string; location?: string; profession?: string; category_slug?: string; serviceArea?: string; experience?: number | string; latitude?: number | null; longitude?: number | null; service_radius_km?: number | string }) =>
      request<{ access_token: string; role: string; professional_id?: string; profile?: Profile | null }>('auth', '/verify-otp', 'POST', input),
    me: () => request<{ role: string; profile: Profile | null; professional?: Professional }>('auth', '/me'),
  },

  catalog: {
    home: () => request<{ categories: Category[]; professionals: Professional[]; popular: Service[] }>('catalog', ''),
    categories: () => request<Category[]>('catalog', '/categories'),
    category: (slug: string) => request<{ category: Category; services: Service[] }>(`catalog`, `/categories/${slug}`),
    services: (categorySlug?: string) =>
      request<Service[]>(`catalog`, `/services${categorySlug ? `?category_slug=${encodeURIComponent(categorySlug)}` : ''}`),
    service: (id: string, opts?: ServiceNearbyOpts) => {
      const q = new URLSearchParams();
      if (opts?.latitude != null && opts?.longitude != null) {
        q.set('latitude', String(opts.latitude));
        q.set('longitude', String(opts.longitude));
      }
      if (opts?.radius_km != null) q.set('radius_km', String(opts.radius_km));
      if (opts?.limit != null) q.set('limit', String(opts.limit));
      const qs = q.toString();
      return request<ServiceDetailResponse>('catalog', `/services/${id}${qs ? `?${qs}` : ''}`);
    },
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
    markAllNotificationsRead: () => request<{ ok: boolean; updated: number }>('customer', '/notifications/read-all', 'PUT'),
    deviceToken: (fcm_token: string) => request<{ ok: boolean }>('customer', '/device-token', 'POST', { fcm_token }),
    coupons: () => request<{ code: string; discount_pct: number; min_amount: number; expires_at: string | null }[]>('customer', '/coupons'),
    quote: (service_id: string, address_id?: string) =>
      request<{ base_price: number; visit_fee: number; discount_amount: number; coupon_code: string | null; total: number }>('customer', '/quote', 'POST', { service_id, address_id }),
    createPaymentOrder: (booking_id: string) => request<{ order_id: string; amount: number; currency: string; key_id: string }>('/payments', '/customer/orders', 'POST', { booking_id }),
    verifyPayment: (payload: { booking_id: string; order_id: string; payment_id: string; signature: string }) =>
      request<{ ok: boolean; booking: Booking }>('/payments', '/customer/verify', 'POST', payload),
    reviews: () => request<Review[]>('customer', '/reviews'),
    addReview: (r: { booking_id?: string | null; professional_id: string; rating: number; comment?: string }) =>
      request<Review>('customer', '/reviews', 'POST', r),
  },

  provider: {
    me: () => request<{ professional: Professional; services: { service: Service }[] }>('provider', '/me'),
    updateMe: (patch: { status?: string; starting_price?: number | string; service_radius_km?: number | string; bio?: string; service_area?: string; latitude?: number; longitude?: number; name?: string }) =>
      request<Professional>('provider', '/me', 'PUT', patch),
    bookings: () => request<Booking[]>('provider', '/bookings'),
    updateAvailability: (payload: { status?: string; latitude?: number; longitude?: number }) =>
      request<{ ok: boolean }>('provider', '/availability', 'POST', payload),
    heartbeat: () => request<{ ok: boolean; online: boolean }>('provider', '/heartbeat', 'POST'),
    deviceToken: (fcm_token: string) => request<{ ok: boolean }>('provider', '/device-token', 'POST', { fcm_token }),
    myServices: () => request<{ category_slug: string; services: (Service & { offered: boolean })[] }>('provider', '/services'),
    setTrade: (category_slug: string) =>
      request<{ category_slug: string; category_name: string; linked: number; starting_price: number }>(
        'provider',
        '/trade',
        'PUT',
        { category_slug }
      ),
    setServices: (service_ids: string[]) =>
      request<{ service_ids: string[]; starting_price: number; linked: number }>('provider', '/services', 'PUT', { service_ids }),
    myBookings: () => request<Booking[]>('provider', '/bookings/mine'),
    booking: (id: string) => request<Booking>('provider', `/bookings/${id}`),
    accept: (id: string) => request<Booking>('provider', `/bookings/${id}/accept`, 'POST'),
    decline: (id: string) => request<{ ok: boolean }>('provider', `/bookings/${id}/decline`, 'POST'),
    updateStatus: (id: string, status: string) =>
      request<Booking>('provider', `/bookings/${id}/status`, 'PUT', { status }),
    earnings: () => request<{ total_earnings: number; by_date: Record<string, number>; payouts: Payout[]; available: number }>('provider', '/earnings'),
    payoutAccount: () => request<{ bank_account_number: string | null; bank_ifsc: string | null; upi_id: string | null }>('/ledger', '/provider/payout-account'),
    savePayoutAccount: (a: { bank_account_number?: string; bank_ifsc?: string; upi_id?: string }) =>
      request<{ ok: boolean }>('/ledger', '/provider/payout-account', 'POST', a),
    dashboard: () => request<{ active: number; completed_jobs: number; today_earnings: number; total_earnings: number }>('provider', '/dashboard'),
    requestPayout: (amount: number) => request<Payout>('provider', '/payouts', 'POST', { amount }),
    submitKyc: (input: { doc_type: string; doc_number: string }) =>
      request<Professional>('provider', '/kyc', 'PUT', input),
  },

  admin: {
    stats: () => request<{ bookings: number; customers: number; providers: number; reviews: number; today_revenue: number; recent_bookings: Booking[] }>('admin', '/stats'),
    revenue: () => request<{ total_platform_fee: number; by_date: Record<string, number> }>('/ledger', '/admin/revenue'),
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
    coupons: () => request<{ id: string; code: string; discount_pct: number; min_amount: number; expires_at: string | null; active: boolean }[]>('admin', '/coupons'),
    createCoupon: (c: { code: string; discount_pct: number; min_amount?: number; expires_at?: string | null }) =>
      request<unknown>('admin', '/coupons', 'POST', c),
    updateCoupon: (id: string, c: { discount_pct?: number; min_amount?: number; expires_at?: string | null; active?: boolean }) =>
      request<unknown>('admin', `/coupons/${id}`, 'PUT', c),
    deleteCoupon: (id: string) => request<{ ok: boolean }>('admin', `/coupons/${id}`, 'DELETE'),
    payouts: () => request<Payout[]>('/ledger', '/admin/payouts'),
    settlePayout: (id: string, s: { status: string; note?: string; settlement_ref?: string }) =>
      request<Payout>('/ledger', `/admin/payouts/${id}`, 'PUT', s),
    refunds: () => request<Refund[]>('/ledger', '/admin/refunds'),
    createRefund: (r: { booking_id?: string | null; amount: number; reason: string; note?: string }) =>
      request<Refund>('/ledger', '/admin/refunds', 'POST', r),
    settleRefund: (id: string, s: { status: string; note?: string }) => request<Refund>('/ledger', `/admin/refunds/${id}`, 'PUT', s),
    disputes: () => request<unknown[]>('/ledger', '/admin/disputes'),
    settleDispute: (id: string, s: { status: string; note?: string }) => request<unknown>('/ledger', `/admin/disputes/${id}`, 'PUT', s),
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

export type ServiceNearbyOpts = {
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number;
  limit?: number;
};

export type ServiceDetailResponse = {
  service: Service;
  providers: Professional[];
  nearby: Professional[];
  nearby_radius_km: number;
  nearby_category_slug: string | null;
};

type Favourite = { id: string; customer_phone: string; professional_id: string };

type AuditLog = { id: string; action: string; detail: string; created_at: string };