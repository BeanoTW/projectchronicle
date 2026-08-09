// Phase 8 — tester-ready gate.
//
// The V2 preview shell (`/v2/*`) runs on the isolated `chronicle_prototype`
// database and exposes preview-only controls such as "Reset preview data".
// Testers must never reach it: it is available through Developer Mode only.
import { Navigate } from 'react-router-dom';
import { useDevMode } from '@/contexts/DevModeContext';

const DevOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { canAccessDevPanel } = useDevMode();
  if (!canAccessDevPanel) return <Navigate to="/timeline" replace />;
  return <>{children}</>;
};

export default DevOnlyRoute;
