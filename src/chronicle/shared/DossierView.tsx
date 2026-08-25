// Phase 6D — shared Dossier orchestrator (Configure + Preview + exports).
// Source-agnostic record data arrives via a DossierAdapter. Report integrity
// receipts operate only on the generated file fingerprint, never record text.
import { useMemo, useState, type ReactNode } from 'react';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import { buildDossierFromSource, compareDossierRecords, defaultDossierConfig, matchesScope, recordDate, type DossierAdapter, type DossierConfig } from './dossierModel';
import { exportDossierPdf } from '../dossier/exportPdf';
import { exportDossierDocx } from '../dossier/exportDocx';
import { isEmbedded, printReport, type Delivery } from '../dossier/deliver';
import { createIntegrityReceiptLink, type IntegrityReceiptLink } from '../dossier/exportIntegrity';
import DossierConfigureView, { type ConfigureRow } from './DossierConfigureView';
import DossierPreviewView from './DossierPreviewView';
import { useIsWide } from './useMediaQuery';
interface Props { adapter: DossierAdapter; onOpenRecord?: (id: string) => void; supportsHistory?: boolean; supportsEvidence?: boolean; intro?: string; previewWithheld?: string | null; helpControl?: ReactNode; }
const configDateLabel = (record: Parameters<typeof recordDate>[0]) => { const date = recordDate(record); return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date not recorded'; };
const DossierView = ({ adapter, onOpenRecord, supportsHistory = true, supportsEvidence = true, intro, previewWithheld = null, helpControl }: Props) => {
  const [cfg, setCfg] = useState<DossierConfig>(defaultDossierConfig); const [tab, setTab] = useState<'configure' | 'preview'>('configure'); const wide = useIsWide();
  const [busy, setBusy] = useState<null | 'pdf' | 'docx'>(null); const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); const [error, setError] = useState<string | null>(null); const [togglingId, setTogglingId] = useState<string | null>(null); const [fallback, setFallback] = useState<Delivery | null>(null); const [printNote, setPrintNote] = useState<string | null>(null); const [integrity, setIntegrity] = useState<IntegrityReceiptLink | null>(null); const [integrityNote, setIntegrityNote] = useState<string | null>(null);
  const { records, media } = adapter;
  const categories = useMemo(() => Array.from(new Set(records.map(r => r.category).filter(Boolean) as string[])).sort(), [records]);
  const people = useMemo(() => Array.from(new Set(records.flatMap(r => r.people))).sort(), [records]);
  const rows: ConfigureRow[] = useMemo(() => records.filter(r => matchesScope(r, cfg)).sort((a, b) => compareDossierRecords(a, b, 'desc')).map(r => ({ id: r.id, label: r.title || r.original_text.slice(0, 48) + (r.original_text.length > 48 ? '…' : ''), meta: `${configDateLabel(r)}${r.category ? ` · ${r.category}` : ''}`, included: r.in_dossier })), [records, cfg]);
  const totalMembers = useMemo(() => records.filter(r => r.in_dossier).length, [records]); const hiddenByFilters = useMemo(() => records.filter(r => r.in_dossier && !matchesScope(r, cfg)).length, [records, cfg]); const includedInDocument = totalMembers - hiddenByFilters;
  const doc = useMemo(() => (wide || tab === 'preview' ? buildDossierFromSource(records, cfg, media) : null), [wide, tab, records, cfg, media]);
  const toggleMember = async (id: string, on: boolean) => { setTogglingId(id); setError(null); try { await adapter.setIncluded(id, on); } catch { setError('That record could not be updated. Nothing has been changed.'); } finally { setTogglingId(null); } };
  const runExport = async (kind: 'pdf' | 'docx') => {
    setBusy(kind); setError(null); setProgress(null); setFallback(null); setPrintNote(null); setIntegrity(null); setIntegrityNote(null);
    try {
      const fresh = buildDossierFromSource(records, cfg, media);
      const onProgress = (done: number, total: number) => setProgress({ done, total });
      // The report is generated and its normal download is attempted first.
      const delivery = kind === 'pdf'
        ? await exportDossierPdf(fresh, cfg, adapter.loadBlob, onProgress)
        : await exportDossierDocx(fresh, cfg, adapter.loadBlob, onProgress);
      if (delivery.status === 'blocked' || isEmbedded()) setFallback(delivery);
      try {
        setIntegrity(await createIntegrityReceiptLink(delivery));
      } catch (receiptError) {
        if (import.meta.env.DEV) console.warn('[my-record] integrity receipt unavailable', receiptError);
        setIntegrityNote('The report was generated, but Chronicle could not create its fingerprint receipt. The report itself is unchanged.');
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[my-record] export failed', kind, err);
      setError('The document could not be generated. Your records are unchanged — please try again.');
    } finally { setBusy(null); setProgress(null); }
  };
  const canExport = includedInDocument > 0;
  return <div><div className="proto-noprint"><ChroniclePageHeader title="Chronicle" eyebrow="Records brought together" subtitle={intro ?? 'The records you have chosen to bring together, in chronological order. A report is generated from them. Original wording is never altered.'} />{helpControl}<div className="proto-viewswitch proto-splittabs" style={{ width: '100%', marginBottom: 14 }} role="group" aria-label="Chronicle view"><button type="button" style={{ flex: 1 }} aria-pressed={tab === 'configure'} data-active={tab === 'configure'} onClick={() => setTab('configure')}>Configure</button><button type="button" style={{ flex: 1 }} aria-pressed={tab === 'preview'} data-guide="chronicle-preview-tab" data-active={tab === 'preview'} onClick={() => setTab('preview')}>Preview report</button></div>{adapter.loading && <p className="proto-help" role="status" style={{ marginBottom: 10 }}>Loading records…</p>}{error && <p className="proto-media-error" role="alert">{error}</p>}</div>
    <div className={wide ? 'proto-split' : undefined} data-testid="myrecord-layout">{(wide || tab === 'configure') && <div className={wide ? 'proto-split-config' : undefined}><DossierConfigureView cfg={cfg} onChange={setCfg} rows={rows} totalRecords={records.length} categories={categories} people={people} onToggleMember={toggleMember} totalMembers={totalMembers} hiddenByFilters={hiddenByFilters} includedInDocument={includedInDocument} evidenceNote={adapter.evidenceNote} supportsHistory={supportsHistory} supportsEvidence={supportsEvidence} busyId={togglingId} /></div>}
      {(wide || tab === 'preview') && <div data-guide="chronicle-preview"><div className="proto-noprint proto-exportbar"><button type="button" className="proto-btn" data-variant="primary" disabled={!canExport || busy !== null} onClick={() => runExport('pdf')}>{busy === 'pdf' ? 'Preparing…' : 'Export PDF report'}</button><button type="button" className="proto-btn" disabled={!canExport || busy !== null} onClick={() => runExport('docx')}>{busy === 'docx' ? 'Preparing…' : 'Export Word report'}</button><button type="button" className="proto-btn" data-variant="ghost" disabled={!canExport || busy !== null} onClick={() => { setError(null); setFallback(null); const result = printReport(); if (result === 'nothing-to-print') setError(previewWithheld ? 'The report is not on screen while Privacy Shield is on, so it cannot be printed. Turn the shield off in Settings, or export a file instead.' : 'There is nothing to print yet. Open Preview report so the document is on screen.'); else if (result === 'blocked') setPrintNote('This browser blocked printing here. Open Chronicle in its own browser tab and try again.'); else setPrintNote('If no print dialog appeared, printing is blocked in this embedded view — open Chronicle in its own browser tab.'); }}>Print</button></div>
        {fallback && <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">Your report is ready. If the download did not start, <a href={fallback.url} download={fallback.filename} target="_blank" rel="noopener noreferrer">open {fallback.filename}</a>.</p>}
        {integrity && <div className="proto-help proto-noprint" style={{ marginBottom: 10 }} role="status"><strong>Integrity receipt ready.</strong>{' '}SHA-256 {integrity.receipt.sha256.slice(0, 12)}…{integrity.receipt.trustedTimestamp.status === 'success' && integrity.receipt.trustedTimestamp.authority ? ` · trusted timestamp from ${integrity.receipt.trustedTimestamp.authority}` : ' · trusted timestamp unavailable or not confirmed'}.{' '}<a href={integrity.url} download={integrity.filename}>Download receipt</a><div style={{ marginTop: 4 }}>The receipt fingerprints this exact exported file; it does not certify the truth or legal status of its contents.</div></div>}
        {integrityNote && <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} role="status">{integrityNote}</p>}
        {printNote && <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">{printNote}</p>}{busy && <p className="proto-help proto-noprint" style={{ marginBottom: 10 }} aria-live="polite">{progress && progress.total > 0 ? `Preparing images ${progress.done} of ${progress.total}…` : `Assembling ${includedInDocument} record${includedInDocument === 1 ? '' : 's'}…`}</p>}
        {includedInDocument === 0 && <div className="proto-empty proto-noprint" style={{ marginBottom: 14 }}>{totalMembers === 0 ? 'No records are included yet. Select records in Configure.' : `All ${totalMembers} included record${totalMembers === 1 ? '' : 's'} fall outside the current scope. Adjust the date range, category or person in Configure.`}</div>}{hiddenByFilters > 0 && includedInDocument > 0 && <p className="proto-help proto-noprint" style={{ marginBottom: 10 }}>{hiddenByFilters} included record{hiddenByFilters === 1 ? ' is' : 's are'} hidden by the current scope and will not appear in the report.</p>}
        {previewWithheld ? <div className="proto-empty proto-noprint" role="status">{previewWithheld}</div> : doc && <DossierPreviewView doc={doc} cfg={cfg} onOpenRecord={onOpenRecord} useMediaUrl={adapter.useMediaUrl} />}</div>}
    </div></div>;
};
export default DossierView;
