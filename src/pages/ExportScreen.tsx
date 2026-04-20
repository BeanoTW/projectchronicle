import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FileText, Clock, Paperclip, Package, Download, BookOpen, Loader2, Briefcase, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import { useToast } from '@/hooks/use-toast';
import {
  generateSummary,
  buildTribunalExportPayload,
  type SummaryResult,
  type SummaryMode,
} from '@/lib/summaryPipeline';
import { renderTemplateHtml, getTemplateFilename } from '@/lib/templateRenderer';
import ExportBuilderModal from '@/components/chronicle/ExportBuilderModal';
import type { ExportItem, SequenceConfig } from '@/lib/sequenceEngine';

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
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [tribunalLoading, setTribunalLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [summaryHighlight, setSummaryHighlight] = useState(false);
  const [lastExportHtml, setLastExportHtml] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const activeIncidents = useMemo(
    () => incidents.filter(i => !i.voided_at),
    [incidents],
  );

  const handleCaseNarrative = () => {
    if (activeIncidents.length < 2) {
      toast({ title: 'Need more records', description: 'Record at least 2 entries to generate a structured record.', variant: 'destructive' });
      return;
    }
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

  const handleOpenBuilder = () => {
    if (activeIncidents.length === 0) {
      toast({ title: 'No records', description: 'Record at least one entry to prepare an export.', variant: 'destructive' });
      return;
    }
    // FIRST Generate: navigation + focus only. Does NOT generate or download.
    toast({ title: 'Opening Export Builder', description: 'Review and confirm before exporting.' });
    setBuilderOpen(true);
  };

  const handleBuilderExport = useCallback(async (_items: ExportItem[], _config: SequenceConfig) => {
    setTribunalLoading(true);
    // Immediate feedback the moment the user taps export.
    toast({ title: 'Preparing structured record…', description: 'Generating your export.' });
    try {
      if (activeIncidents.length === 0) {
        toast({ title: 'No records', description: 'Record at least one entry to generate an export.', variant: 'destructive' });
        return;
      }

      // 1. Render the locked-template HTML for download.
      const html = renderTemplateHtml({
        incidents: activeIncidents,
        followUps: followUpNotes,
        evidence,
      });
      const filename = getTemplateFilename();
      setLastExportHtml(html);

      // 2. Also generate the on-screen structured record so the user sees
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

      // 3. Close the builder. Do NOT auto-deliver — surface both output
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
  const handlePrintExport = useCallback(() => {
    if (!lastExportHtml) return;
    setPrinting(true);

    // Build a self-contained print document that auto-triggers the print
    // dialog on load. We inject a tiny script that calls window.print()
    // after the next paint so fonts/styles settle first.
    const printDoc = lastExportHtml.includes('</body>')
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

    const blob = new Blob([printDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

    if (!printWindow) {
      URL.revokeObjectURL(url);
      setPrinting(false);
      toast({
        title: 'Print blocked',
        description: 'Your browser blocked the print window. Allow pop-ups for this site, then try again.',
        variant: 'destructive',
      });
      return;
    }

    // Release the blob URL after the print window has had time to load it.
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }, 60000);

    // Reset local printing state — the OS print dialog now lives in the
    // dedicated window, not in this app.
    setTimeout(() => setPrinting(false), 800);
  }, [lastExportHtml, toast]);

  const handleDownloadHtml = useCallback(async () => {
    if (!lastExportHtml) return;
    const filename = getTemplateFilename();
    const result = await deliverHtmlFile(lastExportHtml, filename);
    switch (result) {
      case 'shared': toast({ title: 'Export ready to share', description: filename }); break;
      case 'downloaded': toast({ title: 'Export saved', description: filename }); break;
      case 'opened': toast({ title: 'Export opened in browser', description: 'Save the page from the new tab.' }); break;
      case 'cancelled': break;
      case 'failed': toast({ title: 'Export could not be saved', description: 'Try again or use a different browser.', variant: 'destructive' }); break;
    }
  }, [lastExportHtml, toast]);

  const exportTypes = [
    {
      key: 'issue-based-record',
      title: 'Issue-based record',
      description: 'Structured chronological record prepared for formal review or sharing.',
      icon: Briefcase,
      comingSoon: false,
      onExport: handleOpenBuilder,
      loading: false,
      includes: 'Includes: records in chronological order, category labels, people referenced, recorded timestamps, append-only updates',
    },
    { key: 'incident', title: 'Incident Report', description: 'Individual incident with narrative, evidence, and individuals present.', icon: FileText, comingSoon: true, includes: 'Includes: narrative, people involved, attachments, timestamps' },
    { key: 'chronology', title: 'What happened over time', description: 'All records in date order, clearly grouped.', icon: Clock, comingSoon: true, includes: 'Includes: records in chronological order, category labels, dates' },
    { key: 'evidence-index', title: 'Attachment Index', description: 'All attachments with reference numbers and linked records.', icon: Paperclip, comingSoon: true, includes: 'Includes: attachment names, reference numbers, linked records' },
    { key: 'full-bundle', title: 'Full Case Bundle', description: 'Everything combined: cover page, chronology, structured record, attachment index, and all records.', icon: Package, comingSoon: true, includes: 'Includes: cover page, chronology, structured record, attachment index, all records' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-5">
        <h1>Export</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Create structured records ready to share.</p>
      </div>

      {/* Export ready — visible immediately at the top so the user cannot miss it */}
      {lastExportHtml && (
        <div
          ref={resultRef}
          className="mx-5 mb-5 bg-primary/5 border-2 border-primary/40 rounded-xl p-4 shadow-md"
        >
          <p className="text-[14px] font-semibold text-foreground">✓ Your export is ready</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">Choose how to deliver it. Both options use the same export document.</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Button
                variant="default"
                size="sm"
                className="w-full h-11 text-[13px] rounded-lg"
                onClick={handleDownloadHtml}
              >
                <Download className="h-4 w-4 mr-1.5" /> Download HTML
              </Button>
              <p className="text-[11px] text-muted-foreground/70 mt-1 px-1 leading-relaxed">Editable / shareable source file.</p>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11 text-[13px] border-primary/40 text-primary rounded-lg hover:bg-primary/10 bg-card"
                onClick={handlePrintExport}
                disabled={printing}
              >
                {printing ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Opening…</>
                ) : (
                  <><Printer className="h-4 w-4 mr-1.5" /> Print / Save as PDF</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground/70 mt-1 px-1 leading-relaxed">Formal static copy. Allow pop-ups if blocked.</p>
            </div>
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
            <h3 className="text-[15px] font-semibold text-foreground">Structured record</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">A structured overview of all your records.</p>

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
        {exportTypes.map(({ key, title, description, icon: Icon, comingSoon, onExport, loading, includes }, i) => (
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
                      <p className="text-[11px] text-muted-foreground/50 mt-1.5">This feature is still being built</p>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-[13px] border-primary/20 text-primary h-9 rounded-lg hover:bg-primary/4"
                      disabled={!!loading}
                      onClick={onExport}
                    >
                      {loading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><Download className="h-3 w-3 mr-1.5" /> Generate</>}
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
          This record reflects incidents as recorded by the user. Each entry includes an incident date and a recorded timestamp. Updates are appended and do not overwrite original records.
        </p>
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          This tool supports record-keeping and organisation. It does not provide legal advice.
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
    </div>
  );
};

export default ExportScreen;
