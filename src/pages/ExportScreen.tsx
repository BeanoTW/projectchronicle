import { useState, useMemo, useCallback } from 'react';
import { FileText, Clock, Paperclip, Package, Download, BookOpen, Loader2, Briefcase } from 'lucide-react';
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
import {
  renderTribunalHtml,
  getTribunalFilename,
  type SequenceGroup,
} from '@/lib/tribunalRenderer';
import type { IncidentCardHtmlData } from '@/components/chronicle/IncidentRecordCard';
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

  const activeIncidents = useMemo(
    () => incidents.filter(i => !i.voided_at),
    [incidents],
  );

  const handleCaseNarrative = () => {
    if (activeIncidents.length < 2) {
      toast({ title: 'Need more incidents', description: 'Record at least 2 incidents to generate a summary.', variant: 'destructive' });
      return;
    }
    setNarrativeLoading(true);
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

  const handleOpenBuilder = () => {
    if (activeIncidents.length === 0) {
      toast({ title: 'No incidents', description: 'Record at least one incident to generate an export.', variant: 'destructive' });
      return;
    }
    setBuilderOpen(true);
  };

  const handleBuilderExport = useCallback(async (items: ExportItem[], config: SequenceConfig) => {
    setTribunalLoading(true);
    try {
      const allIds = activeIncidents.map(i => i.id);
      const payload = buildTribunalExportPayload({
        incidents: activeIncidents,
        selectedIds: allIds,
        allIncidentCount: allIds.length,
        mode: 'workplace-grievance',
        customPurpose: '',
        options: { includePatterns: true, includeNames: true },
        followUpNotes,
        evidenceFiles: evidence,
      });

      if (!payload) {
        toast({ title: 'Export failed', description: 'No valid incidents to export.', variant: 'destructive' });
        return;
      }

      // Attach sequence groups and standalone cards from export items
      const sequenceGroups: SequenceGroup[] = [];
      const standaloneCards: IncidentCardHtmlData[] = [];

      for (const item of items) {
        if (item.type === 'sequence' && item.sequence) {
          const cards: IncidentCardHtmlData[] = item.incidents.map(inc => ({
            incident: inc,
            followUps: followUpNotes
              .filter(n => n.incident_id === inc.id)
              .map(n => ({ id: n.id, created_at: n.created_at, note_text: n.note_text })),
            evidence: evidence
              .filter(e => e.incident_id === inc.id)
              .map(e => ({ id: e.id, file_name: e.file_name, evidence_ref_number: e.evidence_ref_number })),
          }));
          sequenceGroups.push({
            title: item.sequence.title,
            source: item.sequence.source,
            incident_cards: cards,
          });
        } else {
          item.incidents.forEach(inc => {
            standaloneCards.push({
              incident: inc,
              followUps: followUpNotes
                .filter(n => n.incident_id === inc.id)
                .map(n => ({ id: n.id, created_at: n.created_at, note_text: n.note_text })),
              evidence: evidence
                .filter(e => e.incident_id === inc.id)
                .map(e => ({ id: e.id, file_name: e.file_name, evidence_ref_number: e.evidence_ref_number })),
            });
          });
        }
      }

      payload.sequence_groups = sequenceGroups.length > 0 ? sequenceGroups : undefined;
      payload.standalone_cards = standaloneCards.length > 0 ? standaloneCards : undefined;

      const html = renderTribunalHtml(payload);
      const filename = getTribunalFilename();
      const result = await deliverHtmlFile(html, filename);

      setBuilderOpen(false);

      switch (result) {
        case 'shared':
          toast({ title: 'Export ready to share', description: filename });
          break;
        case 'downloaded':
          toast({ title: 'Export saved', description: filename });
          break;
        case 'opened':
          toast({ title: 'Export opened in browser', description: 'Save the page from the new tab.' });
          break;
        case 'cancelled':
          break;
        case 'failed':
          toast({ title: 'Export could not be saved or shared', description: 'Try again or use a different browser.', variant: 'destructive' });
          break;
      }
    } catch (e) {
      console.error('[Export] Unexpected error:', e);
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setTribunalLoading(false);
    }
  }, [activeIncidents, followUpNotes, evidence, toast]);

  const exportTypes = [
    {
      key: 'workplace-grievance',
      title: 'Workplace Grievance',
      description: 'Issue-based structured record grouped by category for formal review.',
      icon: Briefcase,
      comingSoon: false,
      onExport: handleOpenBuilder,
      loading: tribunalLoading,
    },
    { key: 'incident', title: 'Incident Report', description: 'Individual incident with narrative, evidence, and individuals present.', icon: FileText, comingSoon: true },
    { key: 'chronology', title: 'What happened over time', description: 'All incidents in date order, clearly grouped.', icon: Clock, comingSoon: true },
    { key: 'evidence-index', title: 'Attachment Index', description: 'All attachments with reference numbers and linked records.', icon: Paperclip, comingSoon: true },
    { key: 'full-bundle', title: 'Full Case Bundle', description: 'Everything combined: cover page, chronology, summary, evidence index, and all records.', icon: Package, comingSoon: true },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-5">
        <h1>Export</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Create structured records ready to share.</p>
      </div>

      {/* Case Summary */}
      <div className="mx-5 mb-5 bg-card border border-border rounded-xl p-5">
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
                {narrativeLoading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><BookOpen className="h-3 w-3 mr-1.5" /> Generate structured record</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-5">
        <p className="section-group-title">Export options</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        {exportTypes.map(({ key, title, description, icon: Icon, comingSoon, onExport, loading }, i) => (
            <div key={key} className={`p-4 ${i > 0 ? 'border-t border-border' : ''} ${comingSoon ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
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
