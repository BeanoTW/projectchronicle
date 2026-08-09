// Phase 6C — migrated production Capture route (behind the `v2Capture` flag).
// Real production writes only; no preview database.
import { useNavigate } from 'react-router-dom';
import CaptureView from '@/v2/shared/CaptureView';
import { useProductionCaptureAdapter } from '@/v2/shared/productionCaptureAdapter';
import { DialogProvider } from '@/v2/components/Dialog';
import '@/v2/styles.css';

const CaptureScreenV2 = () => {
  const navigate = useNavigate();
  const adapter = useProductionCaptureAdapter();
  return (
    <DialogProvider>
      <div className="proto-root">
        <div className="proto-page">
          <CaptureView adapter={adapter} onNavigate={path => navigate(path)} />
        </div>
      </div>
    </DialogProvider>
  );
};

export default CaptureScreenV2;
