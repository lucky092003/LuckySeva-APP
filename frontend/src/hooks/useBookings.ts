import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Booking } from '@/types';

export type BookingFilter = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useBookings = (filter: BookingFilter, _customerPhone?: string) => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .bookings()
      .then((rows) => {
        const today = localToday();
        // A confirmed/assigned booking whose scheduled date has already passed
        // is stale — show it as completed instead of keeping it in Upcoming.
        let list: Booking[] = (rows || []).map((b) =>
          (b.status === 'confirmed' || b.status === 'assigned') && b.scheduled_date < today
            ? { ...b, status: 'completed' as Booking['status'] }
            : b,
        );
        if (filter === 'upcoming') {
          list = list
            .filter((b) => b.status === 'confirmed' || b.status === 'assigned')
            .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
        } else if (filter === 'ongoing') list = list.filter((b) => b.status === 'on_the_way' || b.status === 'started');
        else if (filter === 'completed') list = list.filter((b) => b.status === 'completed');
        else if (filter === 'cancelled') list = list.filter((b) => b.status === 'cancelled');
        setData(list);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(load, [load]);
  return { bookings: data, loading, reload: load };
};

export const useProviderBookings = (_professionalId: string | null, status?: string) => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.provider
      .myBookings()
      .then((rows) => {
        const list = status ? (rows || []).filter((b) => b.status === status) : rows || [];
        setData(list);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);
  return { bookings: data, loading, reload: load };
};
