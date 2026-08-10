// Canonical desktop navigation (>= 1024px).
//
// Desktop is treated as a real desktop application: a persistent sidebar with
// Chronicle identity, one prominent New record action (Capture is an action,
// not a browsing destination), the two real destinations, and account/settings
// plus Privacy Shield state at the foot.
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrivacy } from '@/contexts/PrivacyContext';
import '@/chronicle/styles.css';

const primary = [
  { path: '/timeline', label: 'Notebook', hint: 'Browse and find records' },
  { path: '/export', label: 'My Record', hint: 'Assemble and export' },
];

const AppSideNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { enabled: shielded } = usePrivacy();

  const isActive = (p: string) => {
    if (p === '/timeline') return path === '/timeline' || path.startsWith('/incident/');
    if (p === '/export') return path === '/export' || path === '/my-record';
    return path === p;
  };
  const captureActive = path.startsWith('/record');

  return (
    <aside className="proto-root proto-sidenav" aria-label="Primary" data-testid="app-side-nav">
      <button className="proto-sidenav-brand" onClick={() => navigate('/timeline')}>
        <span className="proto-serif">Chronicle</span>
        <span className="proto-sidenav-sub">A chronological record</span>
      </button>

      <button
        type="button"
        className="proto-sidenav-action"
        data-active={captureActive}
        aria-current={captureActive ? 'page' : undefined}
        onClick={() => navigate('/record')}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
        <span>New record</span>
      </button>

      <nav className="proto-sidenav-list">
        {primary.map(({ path: p, label, hint }) => (
          <button
            key={p}
            className="proto-sidenav-item"
            data-active={isActive(p)}
            aria-current={isActive(p) ? 'page' : undefined}
            onClick={() => navigate(p)}
          >
            <span className="proto-sidenav-label">{label}</span>
            <span className="proto-sidenav-hint">{hint}</span>
          </button>
        ))}
      </nav>

      <div className="proto-sidenav-foot">
        <div className="proto-sidenav-status" data-on={shielded}>
          <span className="proto-sidenav-dot" aria-hidden />
          {shielded ? 'Privacy Shield on' : 'Privacy Shield off'}
        </div>
        <button
          className="proto-sidenav-item"
          data-active={path === '/settings'}
          aria-current={path === '/settings' ? 'page' : undefined}
          onClick={() => navigate('/settings')}
        >
          <span className="proto-sidenav-label">Settings</span>
          <span className="proto-sidenav-hint">Account, privacy, data</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSideNav;
