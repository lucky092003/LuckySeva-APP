import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Role = 'customer' | 'provider' | 'admin';

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

export type Screen =
  | { name: 'splash' }
  | { name: 'auth' }
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'notifications' }
  | { name: 'category'; slug: string }
  | { name: 'service'; id: string }
  | { name: 'professionals'; slug: string }
  | { name: 'professional'; id: string }
  | { name: 'booking'; serviceId: string; professionalId?: string }
  | { name: 'payment'; bookingId: string }
  | { name: 'booking-success'; bookingId: string }
  | { name: 'tracking'; bookingId: string }
  | { name: 'bookings' }
  | { name: 'reviews'; bookingId: string }
  | { name: 'profile' }
  | { name: 'help' }
  | { name: 'addresses' }
  | { name: 'favourites' }
  | { name: 'provider-auth' }
  | { name: 'provider-home' }
  | { name: 'provider-bookings' }
  | { name: 'provider-earnings' }
  | { name: 'provider-profile' }
  | { name: 'provider-detail'; bookingId: string }
  | { name: 'admin-auth' }
  | { name: 'admin-dashboard' }
  | { name: 'admin-customers' }
  | { name: 'admin-providers' }
  | { name: 'admin-services' }
  | { name: 'admin-bookings' }
  | { name: 'admin-profile' };

export type Customer = {
  name: string;
  phone: string;
  email: string;
  location: string;
} | null;

const LS_CUSTOMER = 'luckyseva.customer';
const LS_PROVIDER = 'luckyseva.providerId';
const LS_ADMIN = 'luckyseva.adminAuthed';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type AppState = {
  role: Role;
  setRole: (r: Role) => void;
  screen: Screen;
  navigate: (s: Screen) => void;
  back: () => void;
  customer: Customer;
  setCustomer: (c: Customer) => void;
  providerId: string | null;
  setProviderId: (id: string | null) => void;
  adminAuthed: boolean;
  setAdminAuthed: (a: boolean) => void;
};

const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<Role>('customer');
  const [stack, setStack] = useState<Screen[]>([{ name: 'splash' }]);
  const [customer, setCustomerState] = useState<Customer>(load<Customer>(LS_CUSTOMER, null));
  const [providerId, setProviderIdState] = useState<string | null>(load<string | null>(LS_PROVIDER, null));
  const [adminAuthed, setAdminAuthedState] = useState<boolean>(load<boolean>(LS_ADMIN, false));

  const setCustomer = useCallback((c: Customer) => {
    setCustomerState(c);
    save(LS_CUSTOMER, c);
  }, []);

  const setProviderId = useCallback((id: string | null) => {
    setProviderIdState(id);
    save(LS_PROVIDER, id);
  }, []);

  const setAdminAuthed = useCallback((a: boolean) => {
    setAdminAuthedState(a);
    save(LS_ADMIN, a);
  }, []);

  const screen = stack[stack.length - 1];

  const navigate = useCallback((s: Screen) => {
    setStack((prev) => {
      // Bottom-tab roots reset the stack
      const rootNames = ['home', 'bookings', 'profile', 'provider-home', 'provider-bookings', 'provider-earnings', 'provider-profile', 'admin-dashboard'];
      if (rootNames.includes(s.name)) return [s];
      return [...prev, s];
    });
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const setRole = useCallback(
    (r: Role) => {
      setRoleState(r);
      if (r === 'customer') {
        setStack([{ name: 'splash' }]);
      } else if (r === 'provider') {
        setStack([{ name: providerId ? 'provider-home' : 'provider-auth' }]);
      } else {
        setStack([{ name: adminAuthed ? 'admin-dashboard' : 'admin-auth' }]);
      }
    },
    [providerId, adminAuthed]
  );

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        screen,
        navigate,
        back,
        customer,
        setCustomer,
        providerId,
        setProviderId,
        adminAuthed,
        setAdminAuthed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};