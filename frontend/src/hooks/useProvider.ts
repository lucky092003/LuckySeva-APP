import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Professional, Payout } from '@/types';

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
