import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/context/app-context';
import { api, getApiToken } from '@/services/api';
import type { Notification, Professional, Refund, SupportTicket } from '@/types';

const COORDS_KEY = 'luckyseva.coords';

export type Coords = { latitude: number; longitude: number };

function readCachedCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coords;
    if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function cacheCoords(coords: Coords | null) {
  try {
    if (coords) localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
    else localStorage.removeItem(COORDS_KEY);
  } catch {
    /* ignore */
  }
}

export const useCustomerCoords = () => {
  const [coords, setCoords] = useState<Coords | null>(readCachedCoords);

  useEffect(() => {
    if (coords) return;
    if (!getApiToken()) return;
    let active = true;
    api.customer
      .addresses()
      .then((list) => {
        if (!active) return;
        const hit =
          list.find((a) => a.is_default && a.latitude != null && a.longitude != null) ??
          list.find((a) => a.latitude != null && a.longitude != null);
        if (!hit) return;
        const next: Coords = { latitude: hit.latitude as number, longitude: hit.longitude as number };
        cacheCoords(next);
        setCoords(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [coords]);

  return coords;
};

export const useNotifications = (_customerPhone: string | null) => {
  // The JWT decides which bell is read, so the same hook serves both apps:
  // customers hit /customer/notifications, providers /provider/notifications.
  const { role } = useApp();
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  // `silent` swaps the list in place without touching `loading`, so a
  // background refresh never turns an open bell or list into a spinner.
  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      const request = role === 'provider' ? api.provider.notifications() : api.customer.notifications();
      request
        .then((d) => setData(d))
        .catch(() => {
          // A flaky background poll must not wipe what is already on screen;
          // only the first load is allowed to fall back to the empty state.
          if (!silent) setData([]);
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [role],
  );

  useEffect(() => {
    load();
    // A booking can land any second, and both apps used to learn about it only
    // on remount - the desktop bell in WebTopNav never remounted, so its badge
    // was frozen after the first load. Refresh on return to the tab plus a slow
    // visible-only tick, mirroring the Requests feed's safety net.
    const refresh = () => load(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [load]);

  const unread = data.filter((n) => !n.read).length;
  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setMarking(true);
    try {
      if (role === 'provider') await api.provider.markAllNotificationsRead();
      else await api.customer.markAllNotificationsRead();
      load(true);
    } catch {
      /* ignore */
    } finally {
      setMarking(false);
    }
  }, [unread, load, role]);
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

export const useRefunds = () => {
  const [data, setData] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.customer
      .refunds()
      .then((d) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { refunds: data, loading, reload: load };
};
