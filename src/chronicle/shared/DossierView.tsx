// Phase 6D — shared Dossier orchestrator (Configure + Preview + exports).
// Source-agnostic: all data, persistence and blob access arrive via a
// `DossierAdapter`. No Dexie, Supabase or production hooks are imported here.
import { useMemo, useState, type ReactNode } from 'react';
import {
  buildDossierFromSource,
  defaultDossierConfig,
  matchesScope,
  recordDate,
  type DossierAdapter,
  type DossierConfig,
} from './dossierModel';
import { exportDossierPdf } from '../dossier/exportPdf';
import { exportDossierDocx } from '../dossier/exportDocx';
import { isEmbedded, printReport, type Delivery } from '../dossier/deliver';
import DossierConfigureView, { type ConfigureRow } from './DossierConfigureView';
import DossierPreviewView from './DossierPreviewView';
import { useIsWide } from './useMediaQuery';

interface Props {
  adapter: DossierAdapter;
  onOpenRecord?: (id: string) => void;
  supportsHistory?: boolean;
  supportsEvidence?: boolean;
  /** Neutral note shown under the header (e.g. where the data comes from). */
  intro?: string;
  /**
   * When set, the on-screen document preview is withheld and this message is
   * shown instead (Privacy Shield). Exported files are never affected — the
   * shield is a display filter, not a redaction of the record.
   */
  previewWithheld?: string | null;
  /**
   * Optional secondary help affordance (e.g. "? How Chronicle works"). Rendered
   * beneath the intro so it never competes with report or export actions.
   */
  helpControl?: ReactNode;
}

const DossierView = ({ adapter, onOpenRecord, supportsHistory = true, supportsEvidence = true, intro, previewWithheld = null, helpControl }: Props) => {
  const [cfg, setCfg] = useState<DossierConfig>(defaultDossierConfig);
  const [tab, setTab] = useState<'configure' | 'preview'>('configure');
  // Desktop shows configuration and the live report side by side; mobile keeps
  // the single-column tab switch.
  const wide = useIsWide();
  const [busy, setBusy] = useState<null | 'pdf' | 'docx'>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  /* Set when a file was generated but the browser may have suppressed the
     download (embedded preview frames, in-app webviews, some mobile browsers).
     The manual link below is the user's escape hatch. */
  const [fallback, setFallback] = useState<Delivery | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);

  const { records, media } = adapter;

  const categories = useMemo(
    () => Array.from(new Set(records.map(r => r.category).filter(Boolean) as string[])).sort(),
    [records],
  );
  const people = useMemo(() => Array.from(new Set(records.flatMap(r => r.people))).sort(), [records]);

  /* Records offered for selection, narrowed by the same scope filters.
     Narrowing visibility only — membership is never changed by a filter. */
  const rows: ConfigureRow[] = useMemo(
    () =>
      records
        .filter(r => matchesScope(r, cfg))
        .sort((a, b) => b.sealed_at.localeCompare(a.sealed_at))
        .map(r => ({
          id: r.id,
          label: r.title || r.original_text.slice(0, 48) + (r.original_text.length > 48 ? '…' : ''),
          meta: `${new Date(recordDate(r)).toLocaleDateString()}${r.category ? ` · ${r.category}` : ''}`,
          included: r.in_dossier,
        })),
    [records, cfg],
  );

  /* Phase 8 measurement: assembling the full document costs ~1.6s at 5,000
     records, so it is only built when the report is actually being shown or
     exported. Configure only needs counts, which are cheap. */
  const totalMembers = useMemo(() => records.filter(r => r.in_dossier).length, [records]);
  const hiddenByFilters = useMemo(
    () => records.filter(r => r.in_dossier && !matchesScope(r, cfg)).length,
    [records, cfg],
  );
  const includedInDocument = totalMembers - hiddenByFilters;

  const doc = useMemo(
    () => (wide || tab === 'preview' ? buildDossierFromSource(records, cfg, media) : null),
    [wide, tab, records, cfg, media],
  );

  const toggleMember = async (id: string, on: boolean) => {
    setTogglingId(id);
    setError(null);
    try {
      await adapter.setIncluded(id, on);
    } catch {
      setError('That record could not be updated. Nothing has been changed.');
    } finally {
      setTogglingId(null);
    }
  };

  const runExport = async (kind: 'pdf' | 'docx') => {
    setBusy(kind);
    setError(null);
    setProgress(null);
    setFallback(null);
    setPrintNote(null);
    try {
      // Rebuild immediately before writing so the export matches what is on screen.
      const fresh = buildDossierFromSource(records, cfg, media);
      const onProgress = (done: number, total: number) => setProgress({ done, total });
      const delivery = kind === 'pdf'
        ? await exportDossierPdf(fresh, cfg, adapter.loadBlob, onProgress)
        : await exportDossierDocx(fresh, cfg, adapter.loadBlob, onProgress);
      // Offer the manual link whenever the download may not have reached the
      // device — we cannot observe a suppressed download directly.
      if (delivery.status === 'blocked' || isEmbedded()) setFallback(delivery);
    } catch (err) {
      // Exports are read-only: a failure never changes a record.
      if (import.meta.env.DEV) console.error('[my-record] export failed', kind, err);
      setError('The document could not be generated. Your records are unchanged — please try again.');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const canExport = includedInDocument > 0;

  return (
    <div>
      <div className="proto-noprint">
        <h1 className="proto-h1">Chronicle</h1>
        <p className="proto-help" style={{ marginBottom: 12 }}>
          {intro ??
            'The records you have chosen to bring together, in chronological order. A report is generated from them. Original wording is never altered.'}
        </p>

        {helpControl}

        <div className="proto-viewswitch proto-splittabs" style={{ width: '100%', marginBottom: 14 }} role="group" aria-label="Chronicle view">
          <button style={{ flex: 1 }} data-active={tab === 'configure'} onClick={() => setTab('configure')}>Configure</button>
          <button style={{ flex: 1 }} data-guide="chronicle-preview-tab" data-active={tab === 'preview'} onClick={() => setTab('preview')}>Preview report</button>
        </div>

        {adapter.loading && <p className="proto-help" style={{ marginBottom: 10 }}>Loading records…</p>}
        {error && <p className="proto-media-error">{error}</p>}
      </div>

      <div className={wide ? 'proto-split' : undefined} data-testid="myrecord-layout">
      {(wide || tab === 'configure') && (
        <div className={wide ? 'proto-split-config' : undefined}>
        <DossierConfigureView
          cfg={cfg}
          onChange={setCfg}
          rows={rows}
          totalRecords={records.length}
          categories={categories}
          people={people}
          onToggleMember={toggleMember}
          totalMembers={totalMembers}
          hiddenByFilters={hiddenByFilters}
          includedInDocument={includedInDocument}
          evidenceNote={adapter.evidenceNote}
          supportsHistory={supportsHistory}
          supportsEvidence={supportsEvidence}
          busyId={togglingId}
        />
        </div>
      )}
      {(wide || tab === 'preview') && (
        <div data-guide="chronicle-preview">
          <div className="proto-noprint proto-exportbar">
            <button type="button" className="proto-btn" data-variant="primary" disabled={!canExport || busy !== null}
              onClick={() => runExport('pdf')}>
              {busy === 'pdf' ? 'Preparing…' : 'Export PDF report'}
            </button>
            <button type="button" className="proto-btn" disabled={!canExport || busy !== null}
              onClick={() => runExport('docx')}>
              {busy === 'docx' ? 'Preparing…' : 'Export Word report'}
            </button>
            <button type="button" className="proto-btn" data-variant="ghost" disabled={!canExport || busy !== null}
              onClick={() => {
                setError(null);
                setFallback(null);
                const result = printReport();
                if (result === 'nothing-to-print') {
                  setError(previewWithheld
                    ? 'The report is not on screen while Privacy Shield is on, so it cannot be printed. Turn the shield off in Settings, or export a file instead.'
                    : 'There is nothing to print yet. Open Preview report so the document is on screen.');
                } else if (result === 'blocked') {
                  setPrintNote('This browser blocked printing here. Open Chronicle in its own browser tab and try again.');
                } else {
                  setPrintNote('If no print dialog appeared, printing is blocked in this embedded view — open Chronicle in its own browser tab.');
                }
              }}>
              Print
            </button>
          </div>

          {fallback && (
            <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">
              Your report is ready. If the download did not start,{' '}
              <a href={fallback.url} download={fallback.filename} target="_blank" rel="noopener noreferrer">
                open {fallback.filename}
              </a>.
            </p>
          )}

          {printNote && (
            <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">{printNote}</p>
          )}

          {busy && (
            <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">
              {progress && progress.total > 0
                ? `Preparing images ${progress.done} of ${progress.total}…`
                : `Assembling ${includedInDocument} record${includedInDocument === 1 ? '' : 's'}…`}
            </p>
          )}

          {includedInDocument === 0 && (
            <div className="proto-empty proto-noprint" style={{ marginBottom: 14 }}>
              {totalMembers === 0
                ? 'No records are included yet. Select records in Configure.'
                : `All ${totalMembers} included record${totalMembers === 1 ? '' : 's'} fall outside the current scope. Adjust the date range, category or person in Configure.`}
            </div>
          )}

          {hiddenByFilters > 0 && includedInDocument > 0 && (
            <p className="proto-help proto-noprint" style={{ marginBottom: 10 }}>
              {hiddenByFilters} included record{hiddenByFilters === 1 ? ' is' : 's are'} hidden
              by the current scope and will not appear in the report.
            </p>
          )}

          {previewWithheld ? (
            <div className="proto-empty proto-noprint" role="status">{previewWithheld}</div>
          ) : doc && (
            <DossierPreviewView doc={doc} cfg={cfg} onOpenRecord={onOpenRecord} useMediaUrl={adapter.useMediaUrl} />
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default DossierView;
