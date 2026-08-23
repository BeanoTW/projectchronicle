import { useNavigate } from 'react-router-dom';
import type { V2Media } from '@/chronicle/model/schema';
import { usePrivacy } from '@/contexts/PrivacyContext';

export const CanonicalEvidenceList = ({ files }: { files: readonly V2Media[] }) => {
  const navigate = useNavigate();
  const { enabled: shielded, maskFilename, maskText } = usePrivacy();
  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="proto-h2">Attachments</h2>
      {files.length === 0 ? <div className="proto-empty">No attachments on this record.</div> : files.map(file => (
        <div key={file.id} className="proto-entry">
          <div className="proto-entry-meta">
            <span>{file.kind === 'other' ? 'File' : file.kind}</span>
            <span>{new Date(file.added_at).toLocaleString()}</span>
            {file.role === 'legacy_unresolved' && <span className="proto-chip">Legacy timing unconfirmed</span>}
            {file.inclusion.state === 'excluded_from_dossier' && <span className="proto-chip">Excluded from Chronicle</span>}
          </div>
          <div style={{ fontSize: 14 }}>{shielded ? maskFilename(file.name) : file.name}</div>
          {file.description && <p className="proto-help" style={{ marginTop: 4 }}>{shielded ? maskText(file.description) : file.description}</p>}
        </div>
      ))}
      <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/attachments')}>
        Manage attachments
      </button>
    </section>
  );
};
