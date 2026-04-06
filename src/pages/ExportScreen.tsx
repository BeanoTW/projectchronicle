import { useState, useMemo } from 'react';
import { FileText, Clock, Paperclip, Package, Download, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AILabel from '@/components/chronicle/AILabel';
import {
  generateSummary,
  type SummaryResult,
  type SummaryMode,
} from '@/lib/summaryPipeline';

const ExportScreen = () => {
  const { data: incidents = [] } = useIncidents();
  const { data: evidence = [] } = useEvidence();
  const { data: followUpNotes = [] } = useAllFollowUpNotes();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const handleCaseNarrative = () => {
    if (incidents.length < 2) {
      toast({ title: 'Need more incidents', description: 'Record at least 2 incidents to generate a summary.', variant: 'destructive' });
      return;
    }
    setNarrativeLoading(true);
    try {
      const allIds = incidents.filter(i => !i.voided_at).map(i => i.id);
      const result = generateSummary({
        incidents,
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

  const handleExport = async (exportType: string) => {
    setExporting(exportType);
    try {
      const { data, error } = await supabase.functions.invoke('generate-export', { body: { exportType } });
      if (error) throw error;
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded' });
    } catch (e) {
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const exportTypes = [
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

      {/* Case Summary — uses shared pipeline */}
      <div className="mx-5 mb-5 bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">Your situation so far</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">A structured narrative combining all your incidents.</p>
            
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
                disabled={narrativeLoading || incidents.length < 2}
              >
                {narrativeLoading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><BookOpen className="h-3 w-3 mr-1.5" /> Generate Summary</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-5">
        <p className="section-group-title">Export options</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        {exportTypes.map(({ key, title, description, icon: Icon, comingSoon }, i) => (
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
                      disabled={exporting === key}
                      onClick={() => handleExport(key)}
                    >
                      {exporting === key ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><Download className="h-3 w-3 mr-1.5" /> Generate</>}
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
    </div>
  );
};

export default ExportScreen;
