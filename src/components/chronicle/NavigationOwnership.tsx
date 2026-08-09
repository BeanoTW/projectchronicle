// Navigation ownership — Phase 8 fix.
//
// Exactly one navigation system may be mounted for the surface currently on
// screen. Ownership is claimed by the *rendered* screen, not by a global flag,
// so mixed V1/V2 feature-flag states and browser Back both stay correct: a V2
// screen claims on mount and releases on unmount.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type NavOwner = 'v1' | 'v2';

/** Pure resolver (unit-testable): any live V2 claim moves ownership to V2. */
export const resolveNavOwner = (v2Claims: number): NavOwner => (v2Claims > 0 ? 'v2' : 'v1');

type Ctx = {
  owner: NavOwner;
  claimV2: () => () => void;
};

const NavigationOwnershipContext = createContext<Ctx | null>(null);

export const NavigationOwnershipProvider = ({ children }: { children: React.ReactNode }) => {
  const [claims, setClaims] = useState(0);

  const value = useMemo<Ctx>(() => ({
    owner: resolveNavOwner(claims),
    claimV2: () => {
      setClaims(n => n + 1);
      return () => setClaims(n => Math.max(0, n - 1));
    },
  }), [claims]);

  return (
    <NavigationOwnershipContext.Provider value={value}>
      {children}
    </NavigationOwnershipContext.Provider>
  );
};

/** Which navigation the current shell should render. Defaults to V1. */
export const useNavigationOwner = (): NavOwner =>
  useContext(NavigationOwnershipContext)?.owner ?? 'v1';

/**
 * Called by every V2 production screen. While such a screen is mounted the
 * legacy V1 navigation is not rendered at all.
 */
export const useOwnNavigationV2 = () => {
  const ctx = useContext(NavigationOwnershipContext);
  useEffect(() => {
    if (!ctx) return;
    return ctx.claimV2();
    // claimV2 is stable in behaviour; re-running on identity change would
    // double-count, so the claim is intentionally mount-scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
