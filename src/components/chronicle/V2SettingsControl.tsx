// Phase 9 — secondary shell control for full V2 mode.
//
// The accepted primary navigation (Notebook · Capture · My Record) is not
// changed. Account/settings is reached from a compact top-right control that is
// present on every V2 surface, visually subordinate to the core navigation.
import { useInRouterContext, useNavigate } from 'react-router-dom';

const V2SettingsControl = () => {
  const inRouter = useInRouterContext();
  // Rendered inside presentation-only tests without a router — degrade quietly.
  if (!inRouter) return null;
  return <SettingsButton />;
};

const SettingsButton = () => {
  const navigate = useNavigate();
  return (
    <div className="proto-set-control">
      <button
        type="button"
        className="proto-set-controlbtn"
        onClick={() => navigate('/settings')}
        aria-label="Settings and account"
        data-testid="v2-settings-control"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9v0a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
        </svg>
        <span className="proto-set-controllabel">Settings</span>
      </button>
    </div>
  );
};

export default V2SettingsControl;
