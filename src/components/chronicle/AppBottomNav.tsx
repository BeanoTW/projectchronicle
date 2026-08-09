// V2-owned bottom navigation: Notebook · Capture · My Record.
// Rendered only while a V2 production screen holds navigation ownership.
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { path: '/timeline', label: 'Notebook' },
  { path: '/record', label: 'Capture' },
  { path: '/export', label: 'My Record' },
];

const AppBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (p: string) => {
    if (p === '/timeline') return path === '/timeline' || path.startsWith('/incident/');
    if (p === '/record') return path.startsWith('/record');
    if (p === '/export') return path === '/export' || path === '/my-record';
    return path === p;
  };

  return (
    <div className="proto-root lg:hidden" data-testid="v2-bottom-nav">
      {/* Keeps content clear of the fixed bar; replaces the V1 nav's spacing. */}
      <div aria-hidden style={{ height: 72, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      <nav className="proto-bottomnav" aria-label="Primary" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {items.map(({ path: p, label }) => (
          <button key={p} data-active={isActive(p)} onClick={() => navigate(p)} aria-label={label}>
            <span>{label}</span>
            <span className="proto-navdot" />
          </button>
        ))}
      </nav>
    </div>
  );
};

export default AppBottomNav;
