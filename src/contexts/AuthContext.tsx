import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { analytics } from '@/lib/analytics/analytics';
import { clearUserScopedState, syncActiveUser, getLastActiveUser } from '@/chronicle/shared/sessionCleanup';
import { authRedirectUrl } from '@/lib/authSite';
import { applyAccountBoundary, quarantineUserData, countUnsyncedFor } from '@/local/accountBoundary';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; alreadyExists?: boolean; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; reason?: 'email_not_confirmed' | 'invalid_credentials' | 'other' | null }>;
  signOut: () => Promise<void>;
  /** Records not yet safely backed up for the active account. */
  unsyncedCount: () => Promise<number>;
}

/**
 * Auth diagnostics never reach a production console: an email address or user
 * id in the browser log is readable by anything running on the page and by
 * anyone looking over the user's shoulder.
 */
const devLog = (message: string, detail?: Record<string, unknown>) => {
  if (import.meta.env.DEV) console.info(`[auth] ${message}`, detail ?? '');
};

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
      // Account switch on a shared device must never surface the previous
      // user's drafts, transient screen state, or locally cached records.
      const previous = getLastActiveUser();
      const nextId = s?.user?.id ?? null;
      syncActiveUser(nextId);
      if ((previous || '') !== (nextId || '')) {
        // Backed-up rows are deleted locally; anything not safely backed up is
        // moved to quarantine so it is neither readable nor lost.
        void applyAccountBoundary(previous, nextId).catch(() => { /* non-fatal */ });
      }
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user?.id) analytics.identify(s.user.id);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      devLog('state change', { event, hasSession: !!session });
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
    devLog('signUp attempt');
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password, // never trim/transform passwords
      options: { emailRedirectTo: authRedirectUrl('/auth/callback') },
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
    devLog('signUp result', { ok: !error, alreadyExists, needsConfirmation });
    if (!error && !alreadyExists) {
      analytics.track('account_created', { needs_confirmation: needsConfirmation });
    }
    return { error: error as Error | null, alreadyExists, needsConfirmation };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    devLog('signIn attempt');
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
    devLog('signIn result', { ok: !error, hasSession: !!data?.session, reason });
    if (!error && data?.session) analytics.track('login_completed');
    return { error: error as Error | null, reason };
  };

  const signOut = async () => {
    const uid = user?.id ?? null;
    // Clear any in-memory unlock session so a re-login starts locked.
    try {
      // Lazy import to avoid a circular module dep with LockContext.
      const { clearLastUnlockedAt } = await import('@/lib/lock/lockStorage');
      if (uid) clearLastUnlockedAt(uid);
    } catch { /* noop */ }
    // Clear user-specific transient UI state and capture drafts. Canonical
    // records are never deleted on sign out.
    clearUserScopedState();
    // Remove this account's cached record content from the live local store.
    // Backed-up rows are dropped (recoverable); unsynced rows are quarantined.
    if (uid) {
      try { await quarantineUserData(uid); } catch { /* non-fatal */ }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    analytics.reset();
  };

  /** How many of this account's records are not yet safely backed up. */
  const unsyncedCount = async () => {
    if (!user?.id) return 0;
    try { return await countUnsyncedFor(user.id); } catch { return 0; }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, unsyncedCount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
