// Persistent global Capture action (mobile / small tablets).
//
// Capture is Chronicle's primary action, so it stays one tap away on every
// authenticated screen. It routes into the single canonical `/record` flow —
// there is no second capture implementation.
//
// The component also owns the only bottom clearance in the shell, so pages end
// naturally instead of carrying a permanent nav-sized blank region.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { captureAction, isCaptureSurface } from './navModel';
import '@/chronicle/styles.css';

/** True while an on-screen keyboard is covering a meaningful part of the view. */
const useKeyboardOpen = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!vv) return;
    const onResize = () => setOpen(window.innerHeight - vv.height > 160);
    onResize();
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return open;
};

const CaptureFab = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const keyboardOpen = useKeyboardOpen();

  // On the capture screen itself the action is already the whole page.
  const hidden = isCaptureSurface(pathname) || keyboardOpen;

  return (
    <div className="proto-root proto-fabwrap" data-hidden={hidden} data-testid="capture-fab-wrap">
      {/* Only clearance in the shell: enough room for the action, nothing more. */}
      <div aria-hidden className="proto-fab-spacer" />
      {!hidden && (
        <button
          type="button"
          className="proto-fab-capture"
          data-testid="capture-fab"
          aria-label="Capture a new record"
          onClick={() => navigate(captureAction.path)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5.5v13M5.5 12h13" />
          </svg>
          <span>{captureAction.label}</span>
        </button>
      )}
    </div>
  );
};

export default CaptureFab;
