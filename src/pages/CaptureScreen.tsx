// Phase 6C — migrated production Capture route (behind the `v2Capture` flag).
// Real production writes only; no preview database.
import { useNavigate } from 'react-router-dom';
import CaptureView from '@/chronicle/shared/CaptureView';
import { useProductionCaptureAdapter } from '@/chronicle/shared/productionCaptureAdapter';
import { DialogProvider } from '@/chronicle/components/Dialog';
import AppSurface from '@/chronicle/shared/AppSurface';
import '@/chronicle/styles.css';

const CaptureScreen = () => {
  const navigate = useNavigate();
  const adapter = useProductionCaptureAdapter();
  return (
    <DialogProvider>
      <AppSurface>
        <div className="proto-page">
          <CaptureView adapter={adapter} onNavigate={path => navigate(path)} />
        </div>
      </AppSurface>
    </DialogProvider>
  );
};

export default CaptureScreen;
