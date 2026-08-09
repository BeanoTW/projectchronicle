// Phase 11 — canonical desktop navigation.
//
// Desktop is a first-class target: the same routes and screens as mobile, but
// a persistent left rail instead of the mobile bottom bar. Rendered only at
// >= 1024px; the bottom bar is rendered only below it, so the two can never
// appear together.
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrivacy } from '@/contexts/PrivacyContext';
import '@/chronicle/styles.css';

const primary = [
  { path: '/timeline', label: 'Notebook', hint: 'Your records' },
  { path: '/record', label: 'Capture', hint: 'Write or speak' },
  { path: '/export', label: 'My Record', hint: 'Build a report' },
];

const AppSideNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { enabled: shielded } = usePrivacy();

  const isActive = (p: string) => {
    if (p === '/timeline') return path === '/timeline' || path.startsWith('/incident/');
    if (p === '/record') return path.startsWith('/record');
    if (p === '/export') return path === '/export';
    return path === p;
  };

  return (
    <aside className="proto-root proto-sidenav" aria-label="Primary" data-testid="app-side-nav">
      <button className="proto-sidenav-brand" onClick={() => navigate('/timeline')}>
        <span className="proto-serif">Chronicle</span>
        <span className="proto-sidenav-sub">A chronological record</span>
      </button>

      <nav className="proto-sidenav-list">
        {primary.map(({ path: p, label, hint }) => (
          <button
            key={p}
            className="proto-sidenav-item"
            data-active={isActive(p)}
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
