import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, Spinner } from '@/components/ui';
import type { Booking } from '@/types';

export const ReviewScreen = ({ bookingId }: { bookingId: string }) => {
  const { navigate } = useApp();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(0);

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

  const submit = async () => {
    if (!booking) return;
    setSubmitting(true);
    setError('');
    try {
      await api.customer.addReview({
        booking_id: booking.id,
        professional_id: booking.professional_id || '',
        rating,
        comment,
      });
      setSubmitting(false);
      navigate({ name: 'bookings' });
    } catch {
      setError('Could not submit your review. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Review" /><Spinner className="py-20" /></div>;
  if (!booking) return <div className="flex flex-1 flex-col"><TopBar title="Review" /></div>;

  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Rate Your Experience" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-6">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Icons.Heart size={28} className="text-emerald-500" />
          </div>
          <p className="mt-3 text-base font-bold text-gray-900">{booking.service_name}</p>
          <p className="text-xs text-gray-500">by {booking.professional_name}</p>
        </div>

        <Card className="mt-6 p-5">
          <p className="text-center text-sm font-semibold text-gray-900">How was the service?</p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(i)}
                className="transition-transform hover:scale-110"
              >
                <Icons.Star
                  size={36}
                  className={(hover || rating) >= i ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
                />
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-amber-500">
            {labels[(hover || rating) - 1]}
          </p>
        </Card>

        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-gray-900">Write a review</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            placeholder="Tell others about your experience..."
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['Punctual', 'Professional', 'Good quality', 'Friendly', 'Value for money', 'Clean work'].map((tag) => (
            <button
              key={tag}
              onClick={() => setComment((c) => (c ? c + ', ' : '') + tag)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-emerald-50 hover:text-emerald-600"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
        {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
