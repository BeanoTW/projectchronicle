import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FileText, Clock, Paperclip, Package, Download, BookOpen, Loader2, Briefcase, Printer, ExternalLink, Share2, EyeOff, ChevronDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { shareExportFile } from '@/lib/shareExport';
import { Button } from '@/components/ui/button';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import { useToast } from '@/hooks/use-toast';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useExportGate } from '@/hooks/useExportGate';
import {
  generateSummary,
  buildTribunalExportPayload,
  type SummaryResult,
  type SummaryMode,
} from '@/lib/summaryPipeline';
import { renderTemplateHtml, getTemplateFilename } from '@/lib/templateRenderer';
import ExportBuilderModal from '@/components/chronicle/ExportBuilderModal';
import ExportTimestampPanel from '@/components/chronicle/ExportTimestampPanel';
import type { ExportItem, SequenceConfig } from '@/lib/sequenceEngine';
import {
  createExportTimestampRecord,
  describeTimestampStatus,
  formatTimestampReadable,
  type ExportTimestampRecord,
} from '@/lib/exportTimestamp';

/**
 * Injects an "Export integrity" footer into the rendered export HTML.
 * The footer declares the SHA-256 fingerprint of the export body above it
 * and the current trusted-timestamp status. The fingerprint is computed
 * BEFORE this footer is injected, so the assertion is non-circular: the
 * fingerprint covers the bytes shown above the footer.
 */
function injectIntegrityFooter(html: string, record: ExportTimestampRecord): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const statusLabel =
    record.status === 'success' ? 'Fingerprint recorded by Chronicle · independently timestamped'
    : record.status === 'failed' ? 'Fingerprint recorded by Chronicle · independent timestamp failed'
    : record.status === 'pending' ? 'Fingerprint recorded by Chronicle · independent timestamp pending'
    : 'Fingerprint recorded by Chronicle · independent timestamping not currently available';

  const tsLine = record.status === 'success' && record.timestampAt && record.authority
    ? `Independent trusted timestamp: ${esc(formatTimestampReadable(record.timestampAt))} (ISO: ${esc(record.timestampAt)}) — authority: ${esc(record.authority)}`
    : record.status === 'unavailable'
      ? 'Independent trusted timestamp: not currently available — no external timestamp authority was contacted'
      : record.status === 'failed'
        ? 'Independent trusted timestamp: not obtained — the request did not complete'
        : 'Independent trusted timestamp: pending';

  const tokenBlock = record.status === 'success' && record.token
    ? `
  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d4d4d4; word-break: break-all;">Token (RFC 3161, base64, truncated): ${esc(record.token.slice(0, 64))}…</div>
  <div style="margin-top: 4px; color: #555;">This timestamp token can be independently verified using standard RFC 3161 verification tools.</div>`
    : '';

  const block = `
<section class="export-integrity" style="margin: 32px 56px 24px; padding: 16px; border: 1px solid #d4d4d4; background: #fafafa; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #444; line-height: 1.6;">
  <div style="font-family: inherit; font-weight: 600; font-size: 11px; color: #222; margin-bottom: 8px; letter-spacing: 0.04em; text-transform: uppercase;">Export integrity</div>
  <div>Export ID: ${esc(record.exportId)}</div>
  <div style="word-break: break-all;">SHA-256 fingerprint: ${esc(record.exportHash)}</div>
  <div>Status: ${esc(statusLabel)}</div>
  <div>${tsLine}</div>${tokenBlock}
  <div style="margin-top: 10px;">Generated locally: ${esc(formatTimestampReadable(record.createdAt))} (ISO: ${esc(record.createdAt)})</div>
  <div style="margin-top: 10px;">The fingerprint covers the export content above this section. The fingerprint was calculated before this integrity section was added.</div>
  <div style="margin-top: 12px; color: #444;">
    This export includes a SHA-256 fingerprint and a structured record of when information was recorded and how it has changed over time.
  </div>
  <div style="margin-top: 8px; color: #444;">This can help show:</div>
  <ul style="margin: 4px 0 0 18px; padding: 0; color: #444;">
    <li>when a record was created</li>
    <li>whether the content has changed since export</li>
    <li>how the record has been updated over time</li>
  </ul>
  <div style="margin-top: 10px; font-style: italic; color: #666;">
    It does not prove who created the record or that the contents are true.
  </div>
</section>
`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${block}</body>`);
  }
  return html + block;
}

async function deliverHtmlFile(html: string, filename: string): Promise<string> {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/html' });

  console.log('[Export] File created:', filename);
  console.log('[Export] HTML length:', html.length, 'bytes');
  console.log('[Export] Blob size:', blob.size, 'bytes');

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      console.log('[Export] Native share completed');
      return 'shared';
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        console.log('[Export] Share cancelled by user');
        return 'cancelled';
      }
      console.warn('[Export] Share failed:', err.message);
    }
  } else {
    console.log('[Export] Native share unavailable or cannot share files');
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    console.log('[Export] Anchor download triggered');
    return 'downloaded';
  } catch (e) {
    console.warn('[Export] Anchor download failed:', e);
  }

  try {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      console.log('[Export] Opened in new browser tab');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'opened';
    }
    URL.revokeObjectURL(url);
    console.warn('[Export] window.open returned null');
  } catch (e) {
    console.warn('[Export] Fallback open failed:', e);
  }

  return 'failed';
}

const ExportScreen = () => {
  const { data: incidents = [] } = useIncidents();
  const { data: evidence = [] } = useEvidence();
  const { data: followUpNotes = [] } = useAllFollowUpNotes();
  const { toast } = useToast();
  const { enabled: privacyEnabled } = usePrivacy();
  const { requireGated, dialogs: gateDialogs } = useExportGate();
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [tribunalLoading, setTribunalLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [summaryHighlight, setSummaryHighlight] = useState(false);
  const [lastExportHtml, setLastExportHtml] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [timestampRecord, setTimestampRecord] = useState<ExportTimestampRecord | null>(null);
  const [timestampLoading, setTimestampLoading] = useState(false);

  // Backwards-compatible alias for existing call sites in this file.
  const requirePrivacyConfirm = requireGated;

  const activeIncidents = useMemo(
    () => incidents.filter(i => !i.voided_at),
    [incidents],
  );

  // Date range across active records, used in the collapsed Structured Record header.
  const recordDateRange = useMemo(() => {
    const dates = activeIncidents
      .map(i => parseISO(i.incident_date))
      .filter(d => isValid(d))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return null;
    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    const fmt = (d: Date) => format(d, 'd MMMM yyyy');
    return oldest.getTime() === newest.getTime()
      ? fmt(oldest)
      : `${fmt(oldest)} to ${fmt(newest)}`;
  }, [activeIncidents]);

  // Collapsible Structured Record card. Default expanded for small sets,
  // collapsed for ≥10 records so the export action stays above the fold.
  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(activeIncidents.length >= 10);
  const summaryCollapseInitialised = useRef(false);
  useEffect(() => {
    if (summaryCollapseInitialised.current) return;
    if (activeIncidents.length === 0) return;
    setSummaryCollapsed(activeIncidents.length >= 10);
    summaryCollapseInitialised.current = true;
  }, [activeIncidents.length]);

  const handleCaseNarrative = () => {
    if (activeIncidents.length < 2) {
      toast({ title: 'Need more records', description: 'Record at least 2 entries to generate a structured record.', variant: 'destructive' });
      return;
    }
    requirePrivacyConfirm(() => {
      setNarrativeLoading(true);
      toast({ title: 'Preparing structured record…', description: 'This will only take a moment.' });
      try {
        const allIds = activeIncidents.map(i => i.id);
        const result = generateSummary({
          incidents: activeIncidents,
          selectedIds: allIds,
          allIncidentCount: allIds.length,
          mode: 'general' as SummaryMode,
          customPurpose: '',
          options: { includePatterns: true, includeNames: true },
          followUpNotes,
          evidenceFiles: evidence,
        });
        setSummaryResult(result);
      } catch (e) {
        toast({ title: 'Summary failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
      } finally {
        setNarrativeLoading(false);
      }
    });
  };

  // Once the structured record is mounted, scroll to it and briefly highlight.
  // Use a layout-effect-style delay (double rAF + small timeout) so the DOM
  // has fully painted the new content before we scroll. This prevents the
  // "scrolled before content existed" failure mode.
  useEffect(() => {
    if (!summaryResult) return;
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const el = summaryRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSummaryHighlight(true);
      setTimeout(() => {
        if (!cancelled) setSummaryHighlight(false);
      }, 1800);
    };
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(tryScroll, 60);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(r1);
    };
  }, [summaryResult]);

  // Scroll the export-ready result block into view as soon as it mounts.
  useEffect(() => {
    if (!lastExportHtml) return;
    const r = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => cancelAnimationFrame(r);
  }, [lastExportHtml]);

  const handleOpenBuilder = () => {
    if (activeIncidents.length === 0) {
      toast({ title: 'No records', description: 'Record at least one entry to prepare an export.', variant: 'destructive' });
      return;
    }
    requirePrivacyConfirm(() => {
      // FIRST Generate: navigation + focus only. Does NOT generate or download.
      toast({ title: 'Opening Export Builder', description: 'Review and confirm before exporting.' });
      setBuilderOpen(true);
    });
  };

  const handleBuilderExport = useCallback(async (_items: ExportItem[], _config: SequenceConfig) => {
    // The user has already passed the export disclosure gate to open the
    // builder. The builder is part of the same export flow and the actual
    // output is only generated after explicit confirmation here. Do not
    // re-gate — that would either silently deadlock behind the modal or
    // require duplicate confirmation.
    const runExport = async () => {
      setTribunalLoading(true);
      toast({ title: 'Preparing structured record…', description: 'Generating your export.' });
      try {
        if (activeIncidents.length === 0) {
          toast({ title: 'No records', description: 'Record at least one entry to generate an export.', variant: 'destructive' });
          return;
        }

        // 1. Render the locked-template HTML for download.
        const baseHtml = renderTemplateHtml({
          incidents: activeIncidents,
          followUps: followUpNotes,
          evidence,
        });

        // 2. Compute the export fingerprint on the BASE html (before the
        //    integrity footer is injected). This way the footer can honestly
        //    state which bytes the fingerprint covers without circularity.
        //    Timestamping is best-effort and never blocks the export.
        setTimestampLoading(true);
        let tsRecord: ExportTimestampRecord | null = null;
        try {
          tsRecord = await createExportTimestampRecord(baseHtml);
        } catch (e) {
          console.warn('[Export] Fingerprint/timestamp step failed:', e);
        } finally {
          setTimestampLoading(false);
        }
        setTimestampRecord(tsRecord);

        // 3. Inject an integrity footer into the export HTML (declaring the
        //    fingerprint of the body above). If timestamping ever succeeds,
        //    the same footer surfaces the trusted-time assertion.
        const html = tsRecord
          ? injectIntegrityFooter(baseHtml, tsRecord)
          : baseHtml;
        setLastExportHtml(html);

        // 4. Also generate the on-screen structured record so the user sees
        //    a mounted output to scroll to (UX requirement).
        try {
          const allIds = activeIncidents.map(i => i.id);
          const result = generateSummary({
            incidents: activeIncidents,
            selectedIds: allIds,
            allIncidentCount: allIds.length,
            mode: 'general' as SummaryMode,
            customPurpose: '',
            options: { includePatterns: false, includeNames: true },
            followUpNotes,
            evidenceFiles: evidence,
          });
          setSummaryResult(result);
        } catch {
          // Non-fatal: download still proceeds.
        }

        // 5. Close the builder. Do NOT auto-deliver — surface both output
        //    actions (Download HTML + Print / Save as PDF) in the result block
        //    so the user sees them as parallel options.
        setBuilderOpen(false);
        toast({ title: 'Export ready', description: 'Choose Download HTML or Print / Save as PDF.' });
      } catch (e) {
        console.error('[Export] Unexpected error:', e);
        toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
      } finally {
        setTribunalLoading(false);
      }
    };
    await runExport();
  }, [activeIncidents, followUpNotes, evidence, toast]);

  /**
   * Print / Save as PDF.
   *
   * Why a dedicated window (not an iframe):
   *   On many mobile browsers (iOS Safari, Android Chrome) and several
   *   desktop browsers, calling `iframe.contentWindow.print()` silently
   *   falls back to printing the TOP-LEVEL document — which is why the
   *   surrounding Lovable/app UI was appearing in the PDF.
   *
   *   Opening the locked export HTML in its own window/tab guarantees the
   *   print scope is the export document and nothing else. The same locked
   *   renderer (`renderTemplateHtml`) is used — no second renderer.
   */
  const openExportInNewTab = useCallback((autoPrint: boolean): 'opened' | 'blocked' => {
    if (!lastExportHtml) return 'blocked';
    const docHtml = autoPrint && lastExportHtml.includes('</body>')
      ? lastExportHtml.replace(
          '</body>',
          `<script>
            (function(){
              function go(){ try { window.focus(); window.print(); } catch(e){} }
              if (document.readyState === 'complete') {
                requestAnimationFrame(function(){ setTimeout(go, 200); });
              } else {
                window.addEventListener('load', function(){
                  requestAnimationFrame(function(){ setTimeout(go, 200); });
                });
              }
            })();
          </script></body>`
        )
      : lastExportHtml;
    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(url);
      return 'blocked';
    }
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 60000);
    return 'opened';
  }, [lastExportHtml]);

  const doPrintExport = useCallback(() => {
    if (!lastExportHtml) return;
    setPrinting(true);
    const result = openExportInNewTab(true);
    if (result === 'blocked') {
      setPrinting(false);
      toast({
        title: 'Could not open print view',
        description: "Please allow pop-ups or use 'Open document'.",
      });
      return;
    }
    setTimeout(() => setPrinting(false), 800);
  }, [lastExportHtml, openExportInNewTab, toast]);
  const handlePrintExport = useCallback(
    () => requirePrivacyConfirm(doPrintExport),
    [requirePrivacyConfirm, doPrintExport],
  );

  const doOpenDocument = useCallback(() => {
    if (!lastExportHtml) return;
    const result = openExportInNewTab(false);
    if (result === 'blocked') {
      toast({
        title: 'Could not open document',
        description: 'Please allow pop-ups for this site.',
      });
    }
  }, [lastExportHtml, openExportInNewTab, toast]);
  const handleOpenDocument = useCallback(
    () => requirePrivacyConfirm(doOpenDocument),
    [requirePrivacyConfirm, doOpenDocument],
  );

  const doDownloadHtml = useCallback(async () => {
    if (!lastExportHtml) return;
    const filename = getTemplateFilename();
    const result = await deliverHtmlFile(lastExportHtml, filename);
    switch (result) {
      case 'shared': toast({ title: 'Export saved', description: filename }); break;
      case 'downloaded': toast({ title: 'Export saved', description: filename }); break;
      case 'opened': break;
      case 'cancelled': break;
      case 'failed': toast({ title: 'Export could not be saved', description: 'Try again or use a different browser.', variant: 'destructive' }); break;
    }
  }, [lastExportHtml, toast]);
  const handleDownloadHtml = useCallback(
    () => requirePrivacyConfirm(() => { void doDownloadHtml(); }),
    [requirePrivacyConfirm, doDownloadHtml],
  );

  const doSendExport = useCallback(async () => {
    if (!lastExportHtml) return;
    const filename = getTemplateFilename();
    const result = await shareExportFile(lastExportHtml, filename, 'Record export');
    if (result === 'shared') {
      toast({ title: 'Export sent', description: 'Sent via your chosen app.' });
    } else if (result === 'downloaded') {
      toast({ title: 'Sharing not supported', description: 'File saved to Downloads instead.' });
    } else if (result === 'failed') {
      toast({ title: 'Could not share export', description: 'Please try again.', variant: 'destructive' });
    }
  }, [lastExportHtml, toast]);
  const handleSendExport = useCallback(
    () => requirePrivacyConfirm(() => { void doSendExport(); }),
    [requirePrivacyConfirm, doSendExport],
  );

  const exportTypes = [
    {
      key: 'issue-based-record',
      title: 'Issue-Based Record',
      description: 'A formal chronological record prepared around a selected issue or set of records.',
      icon: Briefcase,
      comingSoon: false,
      onExport: handleOpenBuilder,
      loading: false,
      includes: 'Useful when sharing records with a union rep, adviser, solicitor, HR, or tribunal.',
      buttonLabel: 'Generate issue-based record',
    },
    {
      key: 'incident',
      title: 'Single Incident Report',
      description: 'A focused report for one selected incident.',
      icon: FileText,
      comingSoon: true,
      includes: 'Includes the original narrative, people involved, evidence references, timestamps, follow-ups, and integrity details.',
    },
    {
      key: 'chronology',
      title: 'Chronology',
      description: 'A clear date-ordered timeline of selected records.',
      icon: Clock,
      comingSoon: true,
      includes: 'Useful for quickly showing what happened, when it happened, and when each entry was recorded.',
    },
    {
      key: 'evidence-index',
      title: 'Attachment Index',
      description: 'A list of attachments and evidence references linked to saved records.',
      icon: Paperclip,
      comingSoon: true,
      includes: 'Includes attachment names, linked record IDs, upload/reference dates where available, and notes.',
    },
    {
      key: 'full-bundle',
      title: 'Full Case Bundle',
      description: 'A complete export package combining records, chronology, attachments, and reference information.',
      icon: Package,
      comingSoon: true,
      includes: 'Designed for later-stage review where a full structured pack is needed.',
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-5">
        <h1>Export</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Create structured records ready to share.</p>
      </div>

      {/* Privacy Shield notice — calm, persistent, not blocking. */}
      {privacyEnabled && (
        <div className="mx-5 mb-4 bg-muted/40 border border-border rounded-xl p-3 flex items-start gap-2.5">
          <EyeOff className="h-4 w-4 text-foreground/70 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-foreground">Privacy Shield is on</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Privacy Shield hides sensitive information on screen. This helps reduce accidental exposure when viewing records. Exports still include the original record. You will be asked to confirm before exporting.
            </p>
          </div>
        </div>
      )}

      {/* Export ready — visible immediately at the top so the user cannot miss it */}
      {lastExportHtml && (
        <div
          ref={resultRef}
          className="mx-5 mb-5 bg-primary/5 border-2 border-primary/40 rounded-xl p-4 shadow-md"
        >
          <p className="text-[15px] font-semibold text-foreground">✓ Your export is ready</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">Choose how you want to use it. Both options use the same document.</p>

          {/* Export integrity surface — fingerprint + trusted-timestamp status. */}
          <div className="mt-3">
            <ExportTimestampPanel record={timestampRecord} loading={timestampLoading} />
          </div>

          {/* PRIMARY: Print / Save as PDF */}
          <div className="mt-4">
            <Button
              variant="default"
              size="lg"
              className="w-full h-12 text-[14px] font-semibold rounded-lg"
              onClick={handlePrintExport}
              disabled={printing}
            >
              {printing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening…</>
              ) : (
                <><Printer className="h-4 w-4 mr-2" /> Print / Save as PDF</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground/80 mt-1.5 px-1 leading-relaxed">
              Opens your document in a clean view for printing or saving as PDF.
            </p>
          </div>

          {/* SECONDARY: Send export via share sheet */}
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 text-[13px] border-primary/40 text-primary rounded-lg hover:bg-primary/10 bg-card"
              onClick={handleSendExport}
            >
              <Share2 className="h-4 w-4 mr-1.5" /> Send export
            </Button>
            <p className="text-[11px] text-muted-foreground/70 mt-1 px-1 leading-relaxed">
              Share via your email or another app.
            </p>
          </div>

          {/* TERTIARY: Download HTML */}
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 text-[13px] border-border text-foreground rounded-lg hover:bg-muted bg-card"
              onClick={handleDownloadHtml}
            >
              <Download className="h-4 w-4 mr-1.5" /> Download HTML
            </Button>
            <p className="text-[11px] text-muted-foreground/70 mt-1 px-1 leading-relaxed">
              Editable or shareable source file.
            </p>
          </div>

          {/* TERTIARY: Open document */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleOpenDocument}
              className="inline-flex items-center text-[12px] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open document
            </button>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 px-1 leading-relaxed">
              View the document directly in your browser.
            </p>
          </div>
        </div>
      )}

      {/* Case Summary */}
      <div
        ref={summaryRef}
        className={`mx-5 mb-5 bg-card border rounded-xl p-5 transition-shadow duration-500 ${
          summaryHighlight ? 'border-primary ring-2 ring-primary/30 shadow-lg' : 'border-border'
        }`}
      >
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">Structured Record</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">A complete structured record of your saved entries.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">Includes chronological entries, categories, people referenced, timestamps, follow-ups, and record integrity information.</p>

            {summaryResult ? (
              <div className="mt-3 space-y-3">
                {summaryResult.sections.map((section) => (
                  <div key={section.key}>
                    {section.title && (
                      <p className="text-[12px] font-semibold text-foreground mb-1">{section.title}</p>
                    )}
                    <p className="text-[13px] text-body whitespace-pre-line leading-relaxed">{section.content}</p>
                  </div>
                ))}
                <button onClick={() => setSummaryResult(null)} className="text-[13px] text-primary font-medium">Regenerate</button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-[13px] border-primary/20 text-primary h-10 rounded-lg hover:bg-primary/4"
                onClick={handleCaseNarrative}
                disabled={narrativeLoading || activeIncidents.length < 2}
              >
                {narrativeLoading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Preparing…</> : <><BookOpen className="h-3 w-3 mr-1.5" /> Generate structured record</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-5">
        <p className="section-group-title">Export options</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        {exportTypes.map(({ key, title, description, icon: Icon, comingSoon, onExport, loading, includes, buttonLabel }, i) => (
            <div key={key} className={`p-4 ${i > 0 ? 'border-t border-border' : ''} ${comingSoon ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                  {includes && (
                    <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{includes}</p>
                  )}
                  {comingSoon ? (
                    <div className="mt-3">
                      <span className="inline-flex items-center text-[12px] text-muted-foreground font-medium bg-muted px-3 py-1.5 rounded-lg">
                        Coming soon
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-[13px] border-primary/20 text-primary h-9 rounded-lg hover:bg-primary/4"
                      disabled={!!loading}
                      onClick={onExport}
                    >
                      {loading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><Download className="h-3 w-3 mr-1.5" /> {buttonLabel || 'Generate'}</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-6 mb-4 px-1 space-y-2">
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          This export reflects records as entered and saved by the user. Each record may include an incident date, recorded timestamp, category, people referenced, attachments, and appended follow-ups.
        </p>
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          Chronicle supports structured record-keeping and organisation. It does not provide legal advice.
        </p>
      </div>

      {/* Export Builder Modal */}
      <ExportBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        incidents={activeIncidents}
        followUpNotes={followUpNotes}
        evidence={evidence}
        onExport={handleBuilderExport}
        loading={tribunalLoading}
      />

      {/*
        Privacy Shield export gate.
        Step 1: Re-authenticate with App Lock (biometric or PIN, or
                explicit "continue without App Lock" if not configured).
        Step 2: Show export disclosure and require explicit confirmation.
        Cancellation or auth failure aborts the pending export action.
        Provided by useExportGate so other screens can reuse the same flow.
      */}
      {gateDialogs}
    </div>
  );
};

export default ExportScreen;
