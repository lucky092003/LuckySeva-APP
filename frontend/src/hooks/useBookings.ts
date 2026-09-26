import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Booking } from '@/types';

export type BookingFilter = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export const useBookings = (filter: BookingFilter, _customerPhone?: string) => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .bookings()
      .then((rows) => {
        let list: Booking[] = rows || [];
        if (filter === 'upcoming') list = list.filter((b) => b.status === 'confirmed' || b.status === 'assigned');
        else if (filter === 'ongoing') list = list.filter((b) => b.status === 'on_the_way' || b.status === 'started');
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
