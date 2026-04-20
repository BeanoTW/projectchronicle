import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; alreadyExists?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Local-first: never block UI on network. Session is restored from
    // localStorage by the supabase client; cap our loading flag so the UI
    // always renders quickly even if the auth network call hangs.
    const settle = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      settle(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => settle(session));

    // Hard cap: if getSession hasn't responded in 800ms (e.g. offline / slow),
    // proceed with whatever cached session the client already has.
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    // Supabase quirk: when an account already exists, the API returns success
    // but `identities` is an empty array. Detect this so the UI can guide the
    // user to sign-in or password reset instead of looping.
    const alreadyExists =
      !error &&
      !!data?.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;
    return { error: error as Error | null, alreadyExists };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
