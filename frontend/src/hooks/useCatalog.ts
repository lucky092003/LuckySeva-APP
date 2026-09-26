import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Category, Service, Professional, Review } from '@/types';

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
