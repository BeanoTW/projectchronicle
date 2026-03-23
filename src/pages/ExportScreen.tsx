import { useState, useMemo } from 'react';
import { FileText, Clock, Paperclip, Package, Download, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AILabel from '@/components/chronicle/AILabel';

interface CaseNarrative {
  title: string;
  overview: string;
  chronology: string;
  patterns_summary: string;
  impact_summary: string;
  key_individuals: { name: string; involvement_count: number; context: string }[];
}

const ExportScreen = () => {
  const { data: incidents = [] } = useIncidents();
  const { data: evidence = [] } = useEvidence();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [caseNarrative, setCaseNarrative] = useState<CaseNarrative | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const patterns = useMemo(() => {
    const result: string[] = [];
    const peopleCounts: Record<string, number> = {};
    incidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    Object.entries(peopleCounts).filter(([, c]) => c >= 2).forEach(([name, count]) => {
      result.push(`${name} appears in ${count} incidents.`);
    });
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    Object.entries(catCounts).filter(([, c]) => c >= 3).forEach(([cat, count]) => {
      result.push(`${count} incidents relate to ${cat}.`);
    });
    return result;
  }, [incidents]);

  const handleExport = async (exportType: string) => {
    setExporting(exportType);
    try {
      const { data, error } = await supabase.functions.invoke('generate-export', {
        body: { exportType },
      });

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

  const handleCaseNarrative = async () => {
    if (incidents.length < 2) {
      toast({ title: 'Need more incidents', description: 'Record at least 2 incidents to generate a summary.', variant: 'destructive' });
      return;
    }
    setNarrativeLoading(true);
    try {
      const incidentSummaries = incidents.map(i => ({
        date: i.incident_date,
        title: i.title,
        category: i.category,
        summary: i.ai_summary || i.raw_narrative.substring(0, 200),
        people_involved: i.people_involved,
        impact: i.impact_note,
      }));

      const { data, error } = await supabase.functions.invoke('generate-case-narrative', {
        body: { incidents: incidentSummaries, patterns },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCaseNarrative(data);
    } catch (e) {
      toast({ title: 'Summary failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setNarrativeLoading(false);
    }
  };

  const exportTypes = [
    {
      key: 'incident',
      title: 'Incident Report',
      description: 'Individual incident with narrative, evidence, witnesses, and record strength.',
      icon: FileText,
      disabled: incidents.length === 0,
    },
    {
      key: 'chronology',
      title: 'What happened over time',
      description: 'All incidents in date order, clearly grouped.',
      icon: Clock,
      disabled: incidents.length === 0,
    },
    {
      key: 'evidence-index',
      title: 'Evidence Index',
      description: 'All evidence with reference numbers and linked incidents.',
      icon: Paperclip,
      disabled: evidence.length === 0,
    },
    {
      key: 'full-bundle',
      title: 'Full Case Bundle',
      description: 'Everything combined: cover page, chronology, summary, evidence index, and all records.',
      icon: Package,
      disabled: incidents.length === 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Export</h1>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          Generate structured reports ready to share with unions, HR, or advisers.
        </p>
      </div>

      {/* Your situation so far */}
      <div className="px-4 mb-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-foreground">Your situation so far</h3>
              <p className="text-[13px] text-body mt-0.5 leading-relaxed">A structured narrative combining all your incidents, highlighting people involved and recurring themes.</p>
              
              {caseNarrative ? (
                <div className="mt-3 space-y-3">
                  <div className="mb-1"><AILabel /></div>
                  <h4 className="text-[14px] font-semibold text-foreground">{caseNarrative.title}</h4>
                  <p className="text-[13px] text-body leading-relaxed">{caseNarrative.overview}</p>
                  
                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-1.5">What happened over time</p>
                    <p className="text-[13px] text-body whitespace-pre-line leading-relaxed">{caseNarrative.chronology}</p>
                  </div>

                  {caseNarrative.key_individuals.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold text-foreground mb-1.5">People involved</p>
                      <div className="space-y-2">
                        {caseNarrative.key_individuals.map((ind, i) => (
                          <p key={i} className="text-[13px] text-body leading-relaxed">
                            <span className="font-medium">{ind.name}</span> ({ind.involvement_count} incidents) — {ind.context}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-1.5">Things that come up more than once</p>
                    <p className="text-[13px] text-body leading-relaxed">{caseNarrative.patterns_summary}</p>
                  </div>

                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-1.5">How this has affected you</p>
                    <p className="text-[13px] text-body leading-relaxed">{caseNarrative.impact_summary}</p>
                  </div>

                  <button onClick={() => setCaseNarrative(null)} className="text-[13px] text-primary font-medium">
                    Regenerate
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-[13px] border-primary/30 text-primary h-10 rounded-xl hover:bg-primary/5"
                  onClick={handleCaseNarrative}
                  disabled={narrativeLoading || incidents.length < 2}
                >
                  {narrativeLoading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</> : <><BookOpen className="h-3 w-3 mr-1.5" /> Generate Summary</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2.5">
        {exportTypes.map(({ key, title, description, icon: Icon, disabled }) => (
          <div key={key} className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
                <p className="text-[13px] text-body mt-0.5 leading-relaxed">{description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-[13px] border-primary/30 text-primary h-10 rounded-xl hover:bg-primary/5"
                  disabled={disabled || exporting === key}
                  onClick={() => handleExport(key)}
                >
                  {exporting === key ? (
                    <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Download className="h-3 w-3 mr-1.5" /> Generate</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-6 mb-4 p-4 rounded-xl bg-muted/40 border border-border/40">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This tool supports record-keeping and organisation. It does not provide legal advice. Consult a qualified adviser before taking formal action.
        </p>
      </div>
    </div>
  );
};

export default ExportScreen;
