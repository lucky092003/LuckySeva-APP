import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useService, useProfessional, insertBookingNotification } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Stars } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Booking } from '@/lib/types';

const TIME_SLOTS = ['08:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'];

const COUPONS: Record<string, { discount: number; label: string; desc: string }> = {
  LUCKY20: { discount: 0.2, label: '20% OFF', desc: 'Flat 20% off (first booking)' },
  SEVA50: { discount: 50, label: '₹50 OFF', desc: 'Flat ₹50 off on any service' },
  CLEAN100: { discount: 100, label: '₹100 OFF', desc: '₹100 off on cleaning services' },
};

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Pay with Cash', icon: 'Banknote', desc: 'Pay the professional after service' },
  { key: 'upi', label: 'UPI', icon: 'Smartphone', desc: 'GPay, PhonePe, Paytm & more' },
  { key: 'card', label: 'Credit / Debit Card', icon: 'CreditCard', desc: 'Mastercard, Visa, RuPay' },
  { key: 'netbanking', label: 'Net Banking', icon: 'Landmark', desc: 'All major banks supported' },
] as const;

export const BookingFlowScreen = ({ serviceId, professionalId }: { serviceId: string; professionalId?: string }) => {
  const { navigate, customer } = useApp();
  const { service, loading } = useService(serviceId);
  const { professional } = useProfessional(professionalId || null);

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(0);
  const [slot, setSlot] = useState('');
  const [address, setAddress] = useState(customer ? '12, Green Park Apartments, Koramangala 5th Block, Bangalore' : '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [method, setMethod] = useState<string>('cash');

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const dateLabel = dates[date].toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Book Service" /><Spinner className="py-20" /></div>;
  if (!service) return <div className="flex flex-1 flex-col"><TopBar title="Book Service" /></div>;

  const base = service.starting_price;
  const visitFee = 49;
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount < 1) {
      discountAmount = Math.round((base + visitFee) * appliedCoupon.discount);
    } else {
      discountAmount = Math.min(appliedCoupon.discount, base + visitFee);
    }
  }
  const total = base + visitFee - discountAmount;

  const applyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    setCouponError('');
    if (!code) return;
    const coupon = COUPONS[code];
    if (!coupon) {
      setCouponError('Invalid coupon code');
      setAppliedCoupon(null);
      return;
    }
    if (code === 'CLEAN100' && service.name.toLowerCase().indexOf('clean') === -1) {
      setCouponError('This coupon is valid only on cleaning services');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({ code, discount: coupon.discount, label: coupon.label });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const confirm = async () => {
    setSubmitting(true);
    const bookingDate = dates[date].toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_name: customer?.name || 'Aarav Sharma',
        customer_phone: customer?.phone || '9876543210',
        customer_address: address,
        service_id: service.id,
        service_name: service.name,
        professional_id: professional?.id || null,
        professional_name: professional?.name || 'Auto-assign',
        scheduled_date: bookingDate,
        scheduled_time: slot,
        notes,
        base_price: base,
        visit_fee: visitFee,
        total_amount: total,
        payment_method: method,
        payment_status: method === 'cash' ? 'cash' : 'pending',
        status: 'confirmed',
      })
      .select()
      .maybeSingle();
    setSubmitting(false);
    if (error || !data) return;
    const booking = data as Booking;
    await insertBookingNotification(
      booking.customer_phone,
      'booking',
      'Booking Confirmed',
      `${booking.service_name} is confirmed for ${dateLabel}, ${booking.scheduled_time}.`,
      booking.id
    );
    if (method === 'cash') {
      navigate({ name: 'booking-success', bookingId: booking.id });
    } else {
      navigate({ name: 'payment', bookingId: booking.id });
    }
  };

  const canNext = step === 1 ? slot !== '' : step === 2 ? address.trim().length > 5 : true;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Book Service" />
      {/* Stepper */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-gray-100 bg-white px-5 py-3">
        {['Date & Time', 'Address', 'Review'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {step > i + 1 ? <Icons.Check size={12} /> : i + 1}
            </div>
            <span className={`text-[11px] font-semibold ${step >= i + 1 ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className="h-px w-4 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Service summary */}
        <Card className="mb-4 flex items-center gap-3 p-3">
          {professional && (
            <img src={professional.avatar_url} alt="" className="h-11 w-11 rounded-xl bg-gray-100 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{service.name}</p>
            {professional ? (
              <p className="text-[11px] text-gray-500">{professional.name} · {inr(professional.starting_price)}</p>
            ) : (
              <p className="text-[11px] text-gray-500">{inr(service.starting_price)} onwards</p>
            )}
          </div>
          {professional && (
            <div className="flex items-center gap-1">
              <Stars rating={professional.rating} size={11} />
              <span className="text-[11px] font-semibold">{professional.rating}</span>
            </div>
          )}
        </Card>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Select Date</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dates.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setDate(i)}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-all ${date === i ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                  >
                    <span className={`text-[10px] font-medium ${date === i ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </span>
                    <span className={`text-base font-bold ${date === i ? 'text-emerald-600' : 'text-gray-900'}`}>{d.getDate()}</span>
                    <span className={`text-[10px] ${date === i ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Select Time Slot</h3>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${slot === s ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 bg-white text-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Service Address</h3>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Flat / House no, Building, Area, Landmark"
                className="w-full rounded-xl border border-gray-200 p-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Add Notes / Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any specific requirements or instructions for the professional"
                className="w-full rounded-xl border border-gray-200 p-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Choose Payment Method</h3>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[pm.icon] || Icons.Wallet;
                  const selected = method === pm.key;
                  return (
                    <button
                      key={pm.key}
                      onClick={() => setMethod(pm.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${selected ? 'text-emerald-700' : 'text-gray-900'}`}>{pm.label}</p>
                        <p className="text-[11px] text-gray-500">{pm.desc}</p>
                      </div>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500' : 'border-gray-300'}`}>
                        {selected && <span className="h-3 w-3 rounded-full bg-emerald-500" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Booking Summary</h3>
              <Card className="space-y-3 p-4">
                <Row label="Service" value={service.name} />
                <Row label="Professional" value={professional?.name || 'Auto-assigned'} />
                <Row label="Date" value={dateLabel} />
                <Row label="Time" value={slot} />
                <Row label="Address" value={address} />
                <Row label="Payment" value={PAYMENT_METHODS.find((pm) => pm.key === method)?.label || method} />
                {notes && <Row label="Notes" value={notes} />}
              </Card>
            </div>

            {/* Coupon */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Apply Coupon</h3>
              {appliedCoupon ? (
                <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50/40 p-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Icons.TicketPercent size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-700">{appliedCoupon.code} · {appliedCoupon.label}</p>
                    <p className="text-[11px] text-gray-500">You saved {inr(discountAmount)}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs font-semibold text-red-400">Remove</button>
                </Card>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-gray-200 px-3.5 py-3 text-sm uppercase placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <Button variant="outline" onClick={applyCoupon} disabled={!couponCode.trim()} className="px-5">
                      Apply
                    </Button>
                  </div>
                  {couponError && <p className="mt-1.5 text-xs text-red-500">{couponError}</p>}
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(COUPONS).map(([code, c]) => (
                      <button
                        key={code}
                        onClick={() => { setCouponCode(code); setCouponError(''); }}
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 p-2.5 text-left"
                      >
                        <Icons.TicketPercent size={15} className="text-emerald-500" />
                        <span className="text-xs font-bold text-gray-900">{code}</span>
                        <span className="text-[11px] text-gray-500">· {c.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Price breakdown */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Price Breakdown</h3>
              <Card className="space-y-2.5 p-4">
                <Row label="Service price" value={inr(base)} />
                <Row label="Visitation fee" value={inr(visitFee)} />
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-600">Discount ({appliedCoupon?.code})</span>
                    <span className="text-xs font-bold text-emerald-600">- {inr(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-emerald-600">{inr(total)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{method === 'cash' ? 'Pay the professional in cash after service' : `You will be redirected to pay securely via ${method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Net Banking'}`}</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white p-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
        )}
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext} className="flex-1">
            Continue
          </Button>
        ) : (
          <Button onClick={confirm} disabled={submitting} className="flex-1">
            {submitting ? 'Confirming...' : method === 'cash' ? `Confirm · ${inr(total)}` : `Pay ${inr(total)}`}
          </Button>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="max-w-[60%] text-right text-xs font-semibold text-gray-900">{value}</span>
  </div>
);
