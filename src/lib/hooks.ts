import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import type { Category, Service, Professional, Review, Booking, Notification, Payout, SupportTicket } from './types';

export const useCategories = () => {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.catalog
      .categories()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  return { categories: data, loading };
};

export const usePopularServices = () => {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.catalog
      .home()
      .then((d) => setData(d.popular))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  return { popularServices: data, loading };
};

export const useService = (id: string | null) => {
  const [data, setData] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.catalog
      .service(id)
      .then((d) => setData(d.service))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);
  return { service: data, loading };
};

export const useProfessionalsByCategory = (slug: string | null) => {
  const [data, setData] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!slug) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.catalog
      .professionals({ category_slug: slug })
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [slug]);
  return { professionals: data, loading };
};

export const useProfessionalsByService = (serviceId: string | null) => {
  const [data, setData] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!serviceId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.catalog
      .service(serviceId)
      .then((d) => setData(d.providers))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [serviceId]);
  return { professionals: data, loading };
};

export const useProfessional = (id: string | null) => {
  const [data, setData] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.catalog
      .professional(id)
      .then((d) => setData(d.professional))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);
  return { professional: data, loading };
};

export const useReviews = (professionalId: string | null) => {
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!professionalId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.catalog
      .reviews(professionalId)
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [professionalId]);
  useEffect(load, [load]);
  return { reviews: data, loading, reload: load };
};

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

export const useNotifications = (_customerPhone: string | null) => {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .notifications()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { notifications: data, loading, reload: load };
};

export const useUnreadNotifications = (customerPhone: string | null) => {
  const { notifications, loading, reload } = useNotifications(customerPhone);
  const unread = notifications.filter((n) => !n.read).length;
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

export const useProfessionalWithFallback = (_providerId: string | null) => {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.provider
      .me()
      .then((res) => setProfessional(res.professional))
      .catch(() => setProfessional(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { professional, loading, reload: load };
};

export const usePayouts = (_professionalId: string | null, status?: string) => {
  const [data, setData] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.provider
      .earnings()
      .then((res) => {
        const list = status ? (res.payouts || []).filter((p) => p.status === status) : res.payouts || [];
        setData(list as Payout[]);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);
  return { payouts: data, loading, reload: load };
};

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