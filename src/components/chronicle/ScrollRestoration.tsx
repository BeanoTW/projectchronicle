// Route-aware scroll restoration.
//
// Chronicle has two scroll owners depending on breakpoint:
//   - mobile  (<1024px): the document/window scrolls
//   - desktop (>=1024px): `.proto-shell-main` is the scroll container
//     (`height: 100dvh; overflow-y: auto`), so the window never scrolls and
//     window.scrollTo(0,0) is a no-op — which is why the previous route's
//     position appeared to carry over.
//
// Forward navigation (PUSH / REPLACE) always starts the destination at the
// top. Browser Back/Forward (POP) is left to the browser so the conventional
// restore behaviour is preserved.
import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Every element that could own vertical scrolling in the current shell. */
export const scrollOwners = (): (HTMLElement | Window)[] => {
  const owners: (HTMLElement | Window)[] = [];
  document.querySelectorAll<HTMLElement>('.proto-shell-main').forEach(el => owners.push(el));
  owners.push(window);
  return owners;
};

export const resetScroll = () => {
  for (const owner of scrollOwners()) {
    if (owner === window) window.scrollTo(0, 0);
    else (owner as HTMLElement).scrollTop = 0;
  }
  // The document element itself can hold scroll in some mobile browsers.
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
};

const ScrollRestoration = () => {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return; // Back/Forward keeps its position.
    resetScroll();
    // The shell container mounts with the route; run once more after paint so
    // late-mounting screens (Notebook lists, Chronicle panes) also start top.
    const raf = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, search, navigationType]);

  return null;
};

export default ScrollRestoration;
