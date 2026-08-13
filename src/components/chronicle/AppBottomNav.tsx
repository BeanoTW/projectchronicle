// Canonical mobile navigation.
//
// Model: three persistent destinations (Home, Notebook, My Record) with Capture
// as the primary *action* seated at the centre. Capture is not a browsing destination,
// so it is expressed as a raised, filled action inside the bar rather than as
// a third equal tab or a detached floating button.
//
// Settings stays reachable from the compact top-right control on every surface
// (SettingsControl), so it never consumes a primary position.
import { useLocation, useNavigate } from 'react-router-dom';

const AppBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const homeActive = path === '/home';
  const notebookActive = path === '/timeline' || path.startsWith('/incident/');
  const captureActive = path.startsWith('/record');
  const recordActive = path === '/export' || path === '/my-record';

  return (
    <div className="proto-root lg:hidden" data-testid="v2-bottom-nav">
      {/* Keeps content clear of the fixed bar. */}
      <div aria-hidden style={{ height: 76, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      <nav className="proto-bottomnav" aria-label="Primary">
        <button
          type="button"
          className="proto-navtab"
          data-active={homeActive}
          aria-current={homeActive ? 'page' : undefined}
          onClick={() => navigate('/home')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M4 10.5 12 4l8 6.5" />
            <path d="M6.5 9.5V20h11V9.5" />
          </svg>
          <span>Home</span>
        </button>

        <button
          type="button"
          className="proto-navtab"
          data-active={notebookActive}
          aria-current={notebookActive ? 'page' : undefined}
          onClick={() => navigate('/timeline')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M5 4.5h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z" />
            <path d="M8 8.5h7M8 12h7M8 15.5h4" />
          </svg>
          <span>Notebook</span>
        </button>

        <div className="proto-navaction">
          <button
            type="button"
            className="proto-captureseat"
            data-active={captureActive}
            aria-current={captureActive ? 'page' : undefined}
            onClick={() => navigate('/record')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5.5v13M5.5 12h13" />
            </svg>
            <span>Capture</span>
          </button>
        </div>

        <button
          type="button"
          className="proto-navtab"
          data-active={recordActive}
          aria-current={recordActive ? 'page' : undefined}
          onClick={() => navigate('/export')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M7 3.5h7l4 4v13H7z" />
            <path d="M14 3.5v4h4" />
            <path d="M10 13h5M10 16.5h3" />
          </svg>
          <span>My Record</span>
        </button>

      </nav>
    </div>
  );
};

export default AppBottomNav;
