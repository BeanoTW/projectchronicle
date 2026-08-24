import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { V2Media } from '@/chronicle/model/schema';
import { canonicalEvidenceWriter } from '@/chronicle/model/canonicalEvidenceWriter';
import { usePrivacy } from '@/contexts/PrivacyContext';

export const CanonicalEvidenceList = ({ ownerId, recordId, files, onChanged }: {
  ownerId: string;
  recordId: string;
  files: readonly V2Media[];
  onChanged: () => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { enabled: shielded, maskFilename, maskText } = usePrivacy();
  const [editing, setEditing] = useState<string | null>(null);
  const [description, setDescription] = useState('');
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
          {editing === file.id ? <div style={{ marginTop: 8 }}>
            <textarea className="proto-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Attachment description" />
            <div className="proto-actions-row" style={{ marginTop: 8 }}>
              <button className="proto-btn" data-variant="ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="proto-btn" data-variant="primary" onClick={async () => { await canonicalEvidenceWriter.describe(ownerId, recordId, file.id, description); setEditing(null); await onChanged(); }}>Save</button>
            </div>
          </div> : <>
            {file.description && <p className="proto-help" style={{ marginTop: 4 }}>{shielded ? maskText(file.description) : file.description}</p>}
            <div className="proto-actions-row" style={{ marginTop: 8 }}>
              <button className="proto-btn" data-variant="ghost" onClick={() => { setDescription(file.description ?? ''); setEditing(file.id); }}>Edit description</button>
              <button className="proto-btn" data-variant="ghost" onClick={async () => { await canonicalEvidenceWriter.setDossierInclusion(ownerId, recordId, file.id, file.inclusion.state !== 'included'); await onChanged(); }}>
                {file.inclusion.state === 'included' ? 'Exclude from Chronicle' : 'Include in Chronicle'}
              </button>
            </div>
          </>}
        </div>
      ))}
      <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/attachments')}>Manage attachments</button>
    </section>
  );
};
