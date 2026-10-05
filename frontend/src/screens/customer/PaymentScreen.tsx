import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, Spinner } from '@/components/ui';
import { inr } from '@/utils/format';
import { useEffect, useState as useS } from 'react';
import type { Booking } from '@/types';

declare global {
  interface Window {
    Razorpay: {
      new (options: {
        key: string;
        amount: number;
        currency: string;
        name: string;
        description?: string;
        order_id: string;
        handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
        prefill?: { name?: string; email?: string; contact?: string };
        theme?: { color?: string };
        modal?: { ondismiss?: () => void };
      }): { open: () => void };
    };
  }
}

const METHODS = [
  { key: 'upi', label: 'UPI', desc: 'GPay, PhonePe, Paytm', icon: 'Smartphone' },
  { key: 'card', label: 'Card', desc: 'Credit / Debit card', icon: 'CreditCard' },
  { key: 'netbanking', label: 'Net Banking', desc: 'All major banks', icon: 'Building2' },
  { key: 'cash', label: 'Cash', desc: 'Pay after service', icon: 'Wallet' },
] as const;

export const PaymentScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useS<Booking | null>(null);
  const [loading, setLoading] = useS(true);
  const [method, setMethod] = useState<string>('upi');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.customer
      .booking(bookingId)
      .then((data) => {
        setBooking(data);
        setLoading(false);
      })
      .catch(() => {
        setBooking(null);
        setLoading(false);
      });
  }, [bookingId]);

  const pay = async () => {
    if (!booking) return;
    setPaying(true);
    try {
      if (method === 'cash') {
        await api.customer.payBooking(bookingId, { payment_method: 'cash', payment_status: 'cash' });
        setPaying(false);
        navigate({ name: 'booking-success', bookingId });
        return;
      }
      // Online: create Razorpay order
      const order = await api.customer.createPaymentOrder(bookingId, method);
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'LuckySeva',
        description: booking.service_name,
        order_id: order.order_id,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            await api.customer.verifyPayment({
              booking_id: bookingId,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setPaying(false);
            navigate({ name: 'booking-success', bookingId });
          } catch (e) {
            setPaying(false);
            alert(e instanceof Error ? e.message : 'Payment verification failed');
          }
        },
        prefill: booking.customer_name
          ? {
              name: booking.customer_name,
              contact: booking.customer_phone,
            }
          : undefined,
        theme: { color: '#10B981' },
        modal: { ondismiss: () => setPaying(false) },
      } as const;
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setPaying(false);
      alert(e instanceof Error ? e.message : 'Could not start payment');
    }
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Payment" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Payment" /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Payment" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Amount */}
        <div className="mb-4 flex flex-col items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
          <p className="text-sm text-white/80">Amount Payable</p>
          <p className="mt-1 text-3xl font-extrabold">{inr(booking.total_amount)}</p>
          <p className="mt-1 text-xs text-white/70">{booking.service_name}</p>
        </div>

        {/* Methods */}
        <h3 className="mb-2 text-sm font-bold text-gray-900">Choose Payment Method</h3>
        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[m.icon];
            const selected = method === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{m.label}</p>
                  <p className="text-[11px] text-gray-500">{m.desc}</p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                  {selected && <Icons.Check size={12} className="m-auto text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Razorpay note */}
        <Card className="mt-4 flex items-center gap-2 p-3">
          <Icons.ShieldCheck size={16} className="text-emerald-500" />
          <p className="text-[11px] text-gray-500">Secured by Razorpay. 256-bit encryption.</p>
        </Card>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <Button onClick={pay} disabled={paying} className="w-full">
          {paying ? (
            <span className="flex items-center gap-2"><Spinner className="p-0 [&>div]:h-4 [&>div]:w-4 [&>div]:border-white/30 [&>div]:border-t-white" /> Processing...</span>
          ) : method === 'cash' ? (
            `Confirm · Pay ${inr(booking.total_amount)} after service`
          ) : (
            `Pay ${inr(booking.total_amount)}`
          )}
        </Button>
      </div>
    </div>
  );
};
