// Minimal media-query hook for layout decisions that cannot be expressed in
// CSS alone (e.g. whether the report preview is built at all).
import { useEffect, useState } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};

/** True on the desktop split-pane breakpoint. */
export const useIsWide = (): boolean => useMediaQuery('(min-width: 1200px)');
