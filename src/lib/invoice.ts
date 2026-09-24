import type { Booking } from './types';

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

export const invoiceAmounts = (booking: Booking) => {
  const service = Number(booking.base_price) || 0;
  const visit = Number(booking.visit_fee) || 0;
  const total = Number(booking.total_amount) || service + visit;
  return {
    service,
    visit,
    total: total >= service + visit ? total : service + visit,
  };
};

export const paymentStatusLabel = (b: Booking) =>
  b.payment_status === 'paid'
    ? 'Paid'
    : b.payment_status === 'cash'
      ? 'Cash on service'
      : 'Pending';