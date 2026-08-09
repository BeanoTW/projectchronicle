import { V2_BASE } from '../routes';
import { useNavigate } from 'react-router-dom';
import CaptureView from '../shared/CaptureView';
import { previewCaptureAdapter } from '../shared/previewCaptureAdapter';

/** Chronicle V2 (candidate) capture — shared view over the preview adapter. */
const CaptureScreen = () => {
  const navigate = useNavigate();
  return <CaptureView adapter={previewCaptureAdapter} onNavigate={p => navigate(p || V2_BASE + '/notebook')} />;
};

export default CaptureScreen;
