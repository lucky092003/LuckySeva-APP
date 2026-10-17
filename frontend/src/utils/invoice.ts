import type { Booking } from '@/types';

export const FIRM = {
  name: 'LuckySeva',
  tagline: 'Trusted Services, At Your Doorstep',
  address: 'Faridabad, Haryana, India',
  phone: '+91 98765 43210',
  email: 'support@luckyseva.in',
};

export const invoiceNumber = (booking: Booking) => {
  const d = new Date(booking.created_at);
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = (booking.id || '').replace(/-/g, '').slice(-6).toUpperCase() || '000000';
  return `LS-${ymd}-${suffix}`;
};

/**
 * What the booking actually cost, from the fields the server froze at booking
 * time: base + visit + priority - discount. `total_amount` (also server-set)
 * is the truth; the recomputed sum is only a fallback for rows old enough to
 * predate it. The invoice must never answer with more than the customer paid,
 * so a coupon discount is shown as its own line instead of being folded away
 * into "service + visit".
 */
export const invoiceAmounts = (booking: Booking) => {
  const service = Number(booking.base_price) || 0;
  const visit = Number(booking.visit_fee) || 0;
  const priority = Number(booking.priority_fee) || 0;
  const discount = Number(booking.discount_amount) || 0;
  const stored = Number(booking.total_amount) || 0;
  const computed = service + visit + priority - discount;
  const total = Math.max(stored > 0 ? stored : computed, 0);
  return { service, visit, priority, discount, total };
};

export const paymentStatusLabel = (b: Booking) =>
  b.payment_status === 'paid'
    ? 'Paid'
    : b.payment_status === 'cash'
      ? 'Cash on service'
      : 'Pending';
