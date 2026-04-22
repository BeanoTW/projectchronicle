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
    const normalizedEmail = email.trim().toLowerCase();
    console.info('[auth] signUp attempt', { email: normalizedEmail });
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password, // never trim/transform passwords
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
    const needsConfirmation = !error && !!data?.user && !data.session;
    console.info('[auth] signUp result', {
      ok: !error,
      alreadyExists,
      needsConfirmation,
      errorMessage: error?.message,
    });
    return { error: error as Error | null, alreadyExists, needsConfirmation };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.info('[auth] signIn attempt', { email: normalizedEmail });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password, // never trim/transform passwords
    });
    // Map Supabase error codes to clear, user-facing reasons.
    let reason: 'email_not_confirmed' | 'invalid_credentials' | 'other' | null = null;
    if (error) {
      const code = (error as { code?: string }).code;
      const msg = error.message?.toLowerCase() ?? '';
      if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
        reason = 'email_not_confirmed';
      } else if (code === 'invalid_credentials' || msg.includes('invalid login')) {
        reason = 'invalid_credentials';
      } else {
        reason = 'other';
      }
    }
    console.info('[auth] signIn result', {
      ok: !error,
      hasSession: !!data?.session,
      userId: data?.user?.id,
      reason,
      errorMessage: error?.message,
    });
    return { error: error as Error | null, reason };
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
