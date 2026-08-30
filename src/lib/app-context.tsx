import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Role = 'customer' | 'provider' | 'admin';

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
  | { name: 'provider-home' }
  | { name: 'provider-bookings' }
  | { name: 'provider-earnings' }
  | { name: 'provider-profile' }
  | { name: 'provider-detail'; bookingId: string }
  | { name: 'admin-dashboard' }
  | { name: 'admin-customers' }
  | { name: 'admin-providers' }
  | { name: 'admin-services' }
  | { name: 'admin-bookings' };

export type Customer = {
  name: string;
  phone: string;
  email: string;
  location: string;
} | null;

type AppState = {
  role: Role;
  setRole: (r: Role) => void;
  screen: Screen;
  navigate: (s: Screen) => void;
  back: () => void;
  customer: Customer;
  setCustomer: (c: Customer) => void;
};

const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<Role>('customer');
  const [stack, setStack] = useState<Screen[]>([{ name: 'splash' }]);
  const [customer, setCustomer] = useState<Customer>(null);

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

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    if (r === 'customer') setStack([{ name: 'splash' }]);
    else if (r === 'provider') setStack([{ name: 'provider-home' }]);
    else setStack([{ name: 'admin-dashboard' }]);
  }, []);

  return (
    <AppContext.Provider
      value={{ role, setRole, screen, navigate, back, customer, setCustomer }}
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
