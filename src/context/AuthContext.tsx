import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchProfile, login as apiLogin, logout as apiLogout, register as apiRegister } from '@/services/api';
import type { Profile, Role } from '@/types';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Profile>;
  register: (email: string, password: string, role: Role, data: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        const p = await fetchProfile();
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session) {
          setProfile(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const p = await fetchProfile();
          setProfile(p);
        }
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const p = await fetchProfile();
    setProfile(p);
  };

  const login = async (email: string, password: string) => {
    const p = await apiLogin(email, password);
    setProfile(p);
    return p;
  };

  const register = async (email: string, password: string, role: Role, data: Record<string, any>) => {
    await apiRegister(email, password, role, data);
  };

  const logout = async () => {
    await apiLogout();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
