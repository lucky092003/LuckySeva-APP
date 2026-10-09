import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type AdminTheme = 'light' | 'dark';

interface AdminThemeContextType {
  theme: AdminTheme;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | null>(null);

const LS_THEME = 'luckyseva.admin_theme';

function loadTheme(): AdminTheme {
  try {
    const raw = localStorage.getItem(LS_THEME);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch { /* ignore */ }
  return 'light';
}

export const AdminThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<AdminTheme>(loadTheme);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.setProperty('color-scheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  );
};

export const useAdminTheme = (): AdminThemeContextType => {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return ctx;
};
