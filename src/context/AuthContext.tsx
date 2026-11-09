import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../lib/types';
import * as auth from '../lib/auth';
import type { RegisterPayload } from '../lib/auth';
import { useSite } from './SiteContext';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { shop } = useSite();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(shop);

  useEffect(() => {
    // Accounts belong to a site with a shop: ours, and an organisation's
    // once it turns its shop on. Without one there is no sign-in, and the
    // API refuses that origin anyway.
    if (!shop) return;
    let cancelled = false;
    auth
      .restoreSession()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shop]);

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) => {
      setUser(await auth.login(email, password));
    },
    register: async (payload) => {
      setUser(await auth.registerCustomer(payload));
    },
    logout: async () => {
      await auth.logout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
