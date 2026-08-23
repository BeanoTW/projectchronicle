// Mobile navigation: a top-left menu control and a slide-out drawer.
//
// The drawer is built on the Radix dialog primitive, so focus trapping,
// Escape-to-close, `aria-modal` semantics and scroll locking are handled by an
// audited implementation rather than hand-rolled. It closes on selection and on
// route change, and never touches browser history.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import ChronicleLockup from '@/chronicle/brand/ChronicleLockup';
import { destinations, isDestinationActive, navIcon } from './navModel';
import '@/chronicle/styles.css';

const AppDrawer = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { enabled: shielded } = usePrivacy();
  const path = location.pathname;
  const startX = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setOpen(false); }, [path]);

  const go = useCallback((to: string) => {
    setOpen(false);
    if (to !== path) navigate(to);
  }, [navigate, path]);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || !panelRef.current) return;
    const dx = Math.min(0, e.touches[0].clientX - startX.current);
    panelRef.current.style.transform = `translateX(${dx}px)`;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null || !panelRef.current) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    panelRef.current.style.transform = '';
    startX.current = null;
    if (dx < -60) setOpen(false);
  };

  const primary = destinations.filter(d => d.group === 'primary');
  const secondary = destinations.filter(d => d.group === 'secondary');

  const item = (to: string, label: string, hint: string, active: boolean) => (
    <button
      key={to}
      type="button"
      className="proto-drawer-item"
      data-guide={`nav-${to.replace(/^\//, '')}`}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      onClick={() => go(to)}
    >
      <span className="proto-drawer-icon" aria-hidden>{navIcon(to)}</span>
      <span className="proto-drawer-text">
        <span className="proto-drawer-label">{label}</span>
        <span className="proto-drawer-hint">{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="proto-root proto-appbar" data-testid="app-topbar">
        <Dialog.Trigger asChild>
          <button type="button" className="proto-appbar-menu" aria-label="Open navigation menu" data-testid="nav-menu-button">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </Dialog.Trigger>
        <button type="button" className="proto-appbar-brand" onClick={() => go('/home')} aria-label="Chronicle home">
          <ChronicleLockup compact markSize={25} />
        </button>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="proto-drawer-overlay" />
        <Dialog.Content
          ref={panelRef}
          className="proto-root proto-drawer"
          data-testid="nav-drawer"
          aria-modal="true"
          aria-label="Navigation"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="proto-drawer-head">
            <Dialog.Title asChild>
              <ChronicleLockup subtitle="A chronological record" />
            </Dialog.Title>
            <Dialog.Description className="proto-drawer-sub" style={{ marginTop: 8 }}>
              Capture events. Build the record.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" className="proto-drawer-close" aria-label="Close navigation menu">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <nav className="proto-drawer-list" aria-label="Primary">
            {primary.map(d => item(d.path, d.label, d.hint, isDestinationActive(d, path)))}
            <div className="proto-drawer-divider" role="presentation" />
            {secondary.map(d => item(d.path, d.label, d.hint, isDestinationActive(d, path)))}
          </nav>

          <div className="proto-drawer-foot">
            <div className="proto-drawer-status" data-on={shielded}>
              <span className="proto-drawer-dot" aria-hidden />
              {shielded ? 'Privacy Shield on' : 'Privacy Shield off'}
            </div>
            <p className="proto-drawer-account" data-testid="drawer-account">
              <span className="proto-drawer-hint">Signed in as</span>
              <span className="proto-drawer-email">{user?.email ?? 'this device'}</span>
            </p>
            <button type="button" className="proto-drawer-signout" onClick={() => { setOpen(false); void signOut(); }}>
              Sign out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AppDrawer;
