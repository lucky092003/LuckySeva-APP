import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { api } from '@/lib/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button } from '@/components/ui';
import { inr, formatRelativeDay } from '@/lib/format';
import type { Booking, BookingStatus, Professional } from '@/lib/types';

const STEPS: { key: BookingStatus; label: string; icon: string }[] = [
  { key: 'confirmed', label: 'Booking Confirmed', icon: 'CheckCircle' },
  { key: 'assigned', label: 'Provider Assigned', icon: 'UserCheck' },
  { key: 'on_the_way', label: 'Provider On The Way', icon: 'Truck' },
  { key: 'started', label: 'Service Started', icon: 'Wrench' },
  { key: 'completed', label: 'Service Completed', icon: 'PartyPopper' },
];

const STATUS_FLOW: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'started', 'completed'];

export const TrackingScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.customer
      .booking(bookingId)
      .then((b) => {
        setBooking(b);
        if (b.professional_id) {
          api.catalog
            .professional(b.professional_id)
            .then((res) => setProfessional(res.professional))
            .catch(() => setProfessional(null));
        }
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [bookingId]);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Track Booking" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Track Booking" /></div>;

  const currentIdx = STATUS_FLOW.indexOf(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Track Booking" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Status banner */}
        <div className={`mb-4 rounded-2xl p-4 text-white ${isCancelled ? 'bg-red-500' : isCompleted ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
          <div className="flex items-center gap-3">
            {isCompleted ? <Icons.PartyPopper size={28} /> : isCancelled ? <Icons.XCircle size={28} /> : <Icons.Loader size={28} className="animate-spin" />}
            <div>
              <p className="text-base font-bold">
                {isCancelled ? 'Booking Cancelled' : isCompleted ? 'Service Completed!' : 'Service in Progress'}
              </p>
              <p className="text-xs text-white/80">{booking.service_name}</p>
            </div>
          </div>
        </div>

        {/* Professional card */}
        {professional && (
          <Card className="mb-4 p-4">
            <div className="flex items-center gap-3">
              <img src={professional.avatar_url} alt="" className="h-14 w-14 rounded-2xl bg-gray-100 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{professional.name}</p>
                <p className="text-[11px] text-gray-500">{professional.skills.join(', ')}</p>
                <div className="mt-1 flex items-center gap-1">
                  <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
                  <span className="text-[11px] font-semibold text-gray-700">{professional.rating}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {professional.phone ? (
                  <a href={`tel:${professional.phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Icons.Phone size={18} />
                  </a>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600/40"><Icons.Phone size={18} /></span>
                )}
                <button onClick={() => navigate({ name: 'help' })} className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <Icons.MessageCircle size={18} />
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <Card className="mb-4 p-4">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Booking Progress</h3>
            <div className="space-y-1">
              {STEPS.map((s, i) => {
                const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[s.icon];
                const done = i <= currentIdx;
                const active = i === currentIdx && !isCompleted;
                return (
                  <div key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'} ${active ? 'ring-4 ring-emerald-100' : ''}`}>
                        {done ? <Icons.Check size={16} /> : <Icon size={16} />}
                      </div>
                      {i < STEPS.length - 1 && <div className={`h-8 w-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-gray-100'}`} />}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</p>
                      {active && <p className="text-[11px] text-emerald-600">In progress...</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Booking details */}
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-bold text-gray-900">Booking Details</h3>
          <Detail icon={<Icons.Calendar size={15} />} label="Date" value={formatRelativeDay(booking.scheduled_date)} />
          <Detail icon={<Icons.Clock size={15} />} label="Time" value={booking.scheduled_time} />
          <Detail icon={<Icons.MapPin size={15} />} label="Address" value={booking.customer_address} />
          <div className="flex items-center justify-between border-t border-gray-50 pt-3">
            <span className="text-sm font-bold text-gray-900">Total Paid</span>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : booking.payment_status === 'cash' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                {booking.payment_status === 'cash' ? 'Cash on service' : booking.payment_status}
              </span>
              <span className="text-base font-bold text-emerald-600">{inr(booking.total_amount)}</span>
            </div>
          </div>
        </Card>

        {isCompleted && (
          <>
            <Button onClick={() => navigate({ name: 'reviews', bookingId })} className="mt-4 w-full">
              <Icons.Star size={16} /> Rate your experience
            </Button>
            <Button variant="outline" onClick={() => navigate({ name: 'invoice', bookingId })} className="mt-2 w-full">
              <Icons.Receipt size={16} /> View Invoice / Receipt
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const Detail = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 text-gray-400">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value}</p>
    </div>
  </div>
);
