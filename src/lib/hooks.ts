import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Category, Service, Professional, Review, Booking } from './types';

export const useCategories = () => {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setData((data as Category[]) || []);
        setLoading(false);
      });
  }, []);
  return { categories: data, loading };
};

export const usePopularServices = () => {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('services')
      .select('*, category:categories(*)')
      .eq('popular', true)
      .then(({ data }) => {
        setData((data as unknown as Service[]) || []);
        setLoading(false);
      });
  }, []);
  return { popularServices: data, loading };
};

export const useServicesByCategory = (categoryId: string | null) => {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!categoryId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('services')
      .select('*')
      .eq('category_id', categoryId)
      .order('popular', { ascending: false })
      .then(({ data }) => {
        setData((data as Service[]) || []);
        setLoading(false);
      });
  }, [categoryId]);
  return { services: data, loading };
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
    supabase
      .from('services')
      .select('*, category:categories(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setData((data as unknown as Service) || null);
        setLoading(false);
      });
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
    supabase
      .from('professionals')
      .select('*')
      .eq('category_slug', slug)
      .order('rating', { ascending: false })
      .then(({ data }) => {
        setData((data as Professional[]) || []);
        setLoading(false);
      });
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
    supabase
      .from('professional_services')
      .select('professional:professionals(*)')
      .eq('service_id', serviceId)
      .then(({ data }) => {
        const pros = ((data || []) as unknown as { professional: Professional }[])
          .map((r) => r.professional)
          .filter(Boolean);
        setData(pros);
        setLoading(false);
      });
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
    supabase
      .from('professionals')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setData((data as Professional) || null);
        setLoading(false);
      });
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
    supabase
      .from('reviews')
      .select('*')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setData((data as Review[]) || []);
        setLoading(false);
      });
  }, [professionalId]);
  useEffect(load, [load]);
  return { reviews: data, loading, reload: load };
};

export type BookingFilter = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export const useBookings = (filter: BookingFilter, customerPhone?: string) => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    let q = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (customerPhone) q = q.eq('customer_phone', customerPhone);
    if (filter === 'upcoming')
      q = q.in('status', ['confirmed', 'assigned']);
    else if (filter === 'ongoing')
      q = q.in('status', ['on_the_way', 'started']);
    else if (filter === 'completed') q = q.eq('status', 'completed');
    else if (filter === 'cancelled') q = q.eq('status', 'cancelled');
    q.then(({ data }) => {
      setData((data as Booking[]) || []);
      setLoading(false);
    });
  }, [filter, customerPhone]);
  useEffect(load, [load]);
  return { bookings: data, loading, reload: load };
};

export const useProviderBookings = (professionalId: string | null, status?: string) => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!professionalId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from('bookings')
      .select('*')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    q.then(({ data }) => {
      setData((data as Booking[]) || []);
      setLoading(false);
    });
  }, [professionalId, status]);
  useEffect(load, [load]);
  return { bookings: data, loading, reload: load };
};

export const useAllBookings = () => {
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setData((data as Booking[]) || []);
        setLoading(false);
      });
  }, []);
  useEffect(load, [load]);
  return { bookings: data, loading, reload: load };
};
