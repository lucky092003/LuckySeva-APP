import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Notification, Professional, SupportTicket } from '@/types';

export const useNotifications = (_customerPhone: string | null) => {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .notifications()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const unread = data.filter((n) => !n.read).length;
  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setMarking(true);
    try {
      await api.customer.markAllNotificationsRead();
      await load();
    } catch {
      /* ignore */
    } finally {
      setMarking(false);
    }
  }, [unread, load]);
  return { notifications: data, unread, loading, marking, markAllRead, reload: load };
};

export const useUnreadNotifications = (customerPhone: string | null) => {
  const { unread, loading, reload } = useNotifications(customerPhone);
  return { unread, loading, reload };
};

export const useFavourites = (_customerPhone: string | null) => {
  const [data, setData] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .favourites()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { favourites: data, loading, reload: load };
};

export const useIsFavourite = (_customerPhone: string | null, professionalId: string | null) => {
  const [isFav, setIsFav] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!professionalId) {
      setIsFav(false);
      setLoaded(true);
      return;
    }
    api.customer
      .favourites()
      .then((list) => setIsFav(!!list.find((p) => p.id === professionalId)))
      .catch(() => setIsFav(false))
      .finally(() => setLoaded(true));
  }, [professionalId]);
  return { isFav, loaded };
};

export async function toggleFavourite(_customerPhone: string | null, professionalId: string) {
  try {
    await api.customer.addFavourite(professionalId);
    return true;
  } catch {
    await api.customer.removeFavourite(professionalId);
    return false;
  }
}

export const useSupportTickets = (_customerPhone: string | null) => {
  const [data, setData] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .tickets()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { tickets: data, loading, reload: load };
};
