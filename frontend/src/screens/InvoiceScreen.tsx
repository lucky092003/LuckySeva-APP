import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Logo } from '@/components/Logo';
import { Spinner, ErrorState, Button, Badge } from '@/components/ui';
import { inr, formatDate } from '@/utils/format';
import { FIRM, invoiceNumber, invoiceAmounts, paymentStatusLabel } from '@/utils/invoice';
import type { Booking } from '@/types';

export const InvoiceScreen = ({ bookingId }: { bookingId: string }) => {
  const { role, back } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        let b: Booking | null = null;
        if (role === 'provider') {
          b = await api.provider.booking(bookingId);
        } else if (role === 'customer') {
          b = await api.customer.booking(bookingId);
        } else {
          const all = await api.admin.bookings();
          b = (all || []).find((x) => x.id === bookingId) || null;
        }
        if (mounted) setBooking(b);
      } catch {
        if (mounted) setError('Could not load this invoice. It may not exist for your account.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [bookingId, role]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Invoice" />
        <Spinner className="py-20" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Invoice" />
        <ErrorState message={error || 'Invoice not found'} />
      </div>
    );
  }

  const { service, visit, total } = invoiceAmounts(booking);
  const no = invoiceNumber(booking);
  const comma = (n: number) => Number(n).toLocaleString('en-IN');

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Invoice" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar p-4">
        <div id="invoice-print" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Logo size={42} />
              <div>
                <p className="text-lg font-extrabold tracking-tight text-gray-900">
                  Lucky<span className="text-orange-500">Seva</span>
                </p>
                <p className="text-[11px] text-gray-500">{FIRM.tagline}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge tone="success">PAYMENT RECEIPT</Badge>
              <p className="mt-2 text-[11px] text-gray-500">
                <span className="block">Invoice No: {no}</span>
                <span className="block">Date: {formatDate(booking.created_at)}</span>
              </p>
            </div>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />

          {/* Firm + bill to */}
          <div className="grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">From</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{FIRM.name}</p>
              <p className="text-[11px] text-gray-500">{FIRM.address}</p>
              <p className="text-[11px] text-gray-500">{FIRM.phone}</p>
              <p className="text-[11px] text-gray-500">{FIRM.email}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Bill To</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{booking.customer_name}</p>
              <p className="text-[11px] text-gray-500">{booking.customer_phone}</p>
              <p className="text-[11px] text-gray-500">{booking.customer_address}</p>
            </div>
          </div>

          {/* Service line */}
          <div className="border-t border-gray-100 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">{booking.service_name}</p>
                <p className="text-[11px] text-gray-500">
                  Provider: {booking.professional_name} · {formatDate(booking.scheduled_date)} · {booking.scheduled_time}
                </p>
              </div>
              <Badge tone={booking.payment_status === 'paid' ? 'success' : 'warning'}>
                {paymentStatusLabel(booking)}
              </Badge>
            </div>
            {booking.notes ? <p className="mt-1 text-[11px] text-gray-400">Note: {booking.notes}</p> : null}
          </div>

          {/* Amount table */}
          <div className="px-5 pb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="py-2 text-left font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-2 text-gray-700">Service charge</td>
                  <td className="py-2 text-right font-medium text-gray-900">{inr(service)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2 text-gray-700">Visit fee</td>
                  <td className="py-2 text-right font-medium text-gray-900">{inr(visit)}</td>
                </tr>
                <tr>
                  <td className="pt-2 text-base font-bold text-gray-900">Total Paid ({booking.payment_method.toUpperCase()})</td>
                  <td className="pt-2 text-right text-xl font-extrabold text-emerald-600">{inr(total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-[11px] text-gray-500">
              Grand Total: {inr(total)} ({comma(total)})
            </p>
            <p className="mt-2 text-center text-[11px] text-gray-400">
              Received with thanks · Generated by {FIRM.name} · Booking ID: {booking.id}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white p-3">
        <Button variant="outline" onClick={back}>
          <Icons.ChevronLeft size={16} /> Back
        </Button>
        <Button onClick={() => window.print()} className="flex-1">
          <Icons.Printer size={16} /> Print / Save PDF
        </Button>
      </div>
    </div>
  );
};