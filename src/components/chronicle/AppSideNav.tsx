// Persistent navigation rail (>= 768px).
//
// Same navigation model as the mobile drawer (src/components/chronicle/navModel.tsx),
// two presentations:
//   768–1023px  compact icon rail (tablet)
//   >= 1024px   full rail with hints, account identity and Sign out
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useAuth } from '@/contexts/AuthContext';
import { captureAction, destinations, isDestinationActive, navIcon } from './navModel';
import '@/chronicle/styles.css';

const AppSideNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { enabled: shielded } = usePrivacy();
  const { user, signOut } = useAuth();

  const captureActive = captureAction.matches(path);
  const primary = destinations.filter(d => d.group === 'primary');
  const secondary = destinations.filter(d => d.group === 'secondary');

  const item = ({ path: p, label, hint }: (typeof destinations)[number]) => {
    const active = isDestinationActive(destinations.find(d => d.path === p)!, path);
    return (
      <button
        key={p}
        className="proto-sidenav-item"
        data-guide={`nav-${p.replace(/^\//, '')}`}
        data-active={active}
        aria-current={active ? 'page' : undefined}
        onClick={() => navigate(p)}
        title={label}
      >
        <span className="proto-sidenav-icon" aria-hidden>{navIcon(p)}</span>
        <span className="proto-sidenav-text">
          <span className="proto-sidenav-label">{label}</span>
          <span className="proto-sidenav-hint">{hint}</span>
        </span>
      </button>
    );
  };

  return (
    <aside className="proto-root proto-sidenav" aria-label="Primary" data-testid="app-side-nav">
      <button className="proto-sidenav-brand" onClick={() => navigate('/home')}>
        <span className="proto-serif">Project Chronicle</span>
        <span className="proto-sidenav-sub">A chronological record</span>
      </button>

      <button
        type="button"
        className="proto-sidenav-action"
        data-guide="nav-capture"
        data-active={captureActive}
        aria-current={captureActive ? 'page' : undefined}
        onClick={() => navigate(captureAction.path)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
        <span className="proto-sidenav-actionlabel">{captureAction.desktopLabel}</span>
      </button>

      <nav className="proto-sidenav-list">{primary.map(item)}</nav>

      <div className="proto-sidenav-foot">
        <nav className="proto-sidenav-list">{secondary.map(item)}</nav>
        <div className="proto-sidenav-status" data-on={shielded}>
          <span className="proto-sidenav-dot" aria-hidden />
          {shielded ? 'Privacy Shield on' : 'Privacy Shield off'}
        </div>
        <p className="proto-sidenav-account" data-testid="rail-account">
          <span className="proto-sidenav-hint">Signed in as</span>
          <span className="proto-sidenav-email">{user?.email ?? 'this device'}</span>
        </p>
        <button type="button" className="proto-sidenav-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default AppSideNav;
