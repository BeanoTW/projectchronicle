import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { seedV2IfEmpty, resetV2DB } from './db';
import CaptureScreen from './screens/Capture';
import ReviewScreen from './screens/Review';
import NotebookScreen from './screens/Notebook';
import EntryScreen from './screens/Entry';
import DossierScreen from './screens/Dossier';
import './styles.css';

const HIDE_FAB_ON = ['/prototype/capture', '/prototype/review'];

const Shell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const showFab = !HIDE_FAB_ON.some(p => path.startsWith(p));

  const activeNotebook = path === '/prototype' || path.startsWith('/prototype/notebook') || path.startsWith('/prototype/entry');
  const activeDossier = path.startsWith('/prototype/dossier');

  return (
    <div className="proto-root">
      <div className="proto-banner">
        <span>Prototype · isolated demo data</span>
        <Link to="/home">Back to app</Link>
      </div>
      <div className="proto-topbar">
        <div>
          <span className="proto-brand">Chronicle</span>
          <span className="proto-brand-sub">Preview</span>
        </div>
        <button
          className="proto-btn"
          data-variant="ghost"
          style={{ padding: '6px 10px', minHeight: 32, fontSize: 12 }}
          onClick={async () => {
            if (confirm('Reset prototype demo data? This only affects the prototype database.')) {
              await resetV2DB();
              navigate('/prototype/notebook');
            }
          }}
        >
          Reset demo
        </button>
      </div>

      <main className="proto-main">{children}</main>

      {showFab && (
        <button
          className="proto-fab"
          onClick={() => navigate('/prototype/capture')}
          aria-label="New capture"
        >
          + Capture
        </button>
      )}

      <nav className="proto-bottomnav" aria-label="Prototype navigation">
        <button data-active={activeNotebook} onClick={() => navigate('/prototype/notebook')}>
          <span>Notebook</span>
          <span className="proto-navdot" />
        </button>
        <button data-active={activeDossier} onClick={() => navigate('/prototype/dossier')}>
          <span>Dossier</span>
          <span className="proto-navdot" />
        </button>
      </nav>
    </div>
  );
};

const V2App = () => {
  useEffect(() => {
    seedV2IfEmpty().catch(() => {});
  }, []);

  return (
    <Shell>
      <Routes>
        <Route index element={<Navigate to="notebook" replace />} />
        <Route path="notebook" element={<NotebookScreen />} />
        <Route path="capture" element={<CaptureScreen />} />
        <Route path="review/:id" element={<ReviewScreen />} />
        <Route path="entry/:id" element={<EntryScreen />} />
        <Route path="dossier" element={<DossierScreen />} />
        <Route path="*" element={<Navigate to="notebook" replace />} />
      </Routes>
    </Shell>
  );
};

export default V2App;
