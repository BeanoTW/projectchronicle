import { V2_BASE } from './routes';
import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { seedV2IfEmpty, resetV2DB } from './db';
import CaptureScreen from './screens/Capture';
import ReviewScreen from './screens/Review';
import NotebookScreen from './screens/Notebook';
import EntryScreen from './screens/Entry';
import DossierScreen from './screens/Dossier';
import { DialogProvider, useDialogs } from './components/Dialog';
import './styles.css';

const HIDE_FAB_ON = [V2_BASE + '/capture', V2_BASE + '/review'];

const Shell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dialogs = useDialogs();
  const path = location.pathname;
  const showFab = !HIDE_FAB_ON.some(p => path.startsWith(p));

  const activeNotebook = path === V2_BASE + '' || path.startsWith(V2_BASE + '/notebook') || path.startsWith(V2_BASE + '/entry');
  const activeDossier = path.startsWith(V2_BASE + '/dossier');

  return (
    <div className="proto-root">
      <div className="proto-banner">
        <span>V2 preview · isolated preview data</span>
        <Link to="/home">Back to app</Link>
      </div>
      <div className="proto-topbar">
        <div>
          <span className="proto-brand">Chronicle</span>
          <span className="proto-brand-sub">V2</span>
        </div>
        <button
          className="proto-btn"
          data-variant="ghost"
          style={{ padding: '6px 10px', minHeight: 32, fontSize: 12 }}
          onClick={async () => {
            const ok = await dialogs.confirm({
              title: 'Reset preview data?',
              body: 'This clears the isolated V2 preview database on this device and restores the sample records. Your existing Chronicle records are not affected.',
              confirmLabel: 'Reset preview data',
              tone: 'danger',
            });
            if (!ok) return;
            await resetV2DB();
            navigate(V2_BASE + '/notebook');
          }}
        >
          Reset preview data
        </button>
      </div>

      <main className="proto-main">{children}</main>

      {showFab && (
        <button
          className="proto-fab"
          onClick={() => navigate(V2_BASE + '/capture')}
          aria-label="New capture"
        >
          + Capture
        </button>
      )}

      <nav className="proto-bottomnav" aria-label="Prototype navigation">
        <button data-active={activeNotebook} onClick={() => navigate(V2_BASE + '/notebook')}>
          <span>Notebook</span>
          <span className="proto-navdot" />
        </button>
        <button data-active={activeDossier} onClick={() => navigate(V2_BASE + '/dossier')}>
          <span>My Record</span>
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
    <DialogProvider>
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
    </DialogProvider>
  );
};

export default V2App;
