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

  const handleExport = async (exportType: string, incidentId?: string) => {
    setExporting(exportType);
    try {
      const { data, error } = await supabase.functions.invoke('generate-export', {
        body: { exportType, incidentId },
      });

      if (error) throw error;

      // data is HTML string, create downloadable file
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
      toast({ title: 'Need more incidents', description: 'Record at least 2 incidents to generate a case summary.', variant: 'destructive' });
      return;
    }
    setNarrativeLoading(true);
    try {
      const incidentSummaries = incidents.map(i => ({
        date: i.incident_date,
        title: i.title,
        category: i.category,
        severity: i.severity,
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
      toast({ title: 'Case narrative failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setNarrativeLoading(false);
    }
  };

  const exportTypes = [
    {
      key: 'incident',
      title: 'Incident Report',
      description: 'Export a single incident as a detailed report.',
      icon: FileText,
      disabled: incidents.length === 0,
    },
    {
      key: 'chronology',
      title: 'Chronology',
      description: 'All incidents in chronological order with monthly grouping.',
      icon: Clock,
      disabled: incidents.length === 0,
    },
    {
      key: 'evidence-index',
      title: 'Evidence Index',
      description: 'Table of all evidence with E-ref numbers and linked incidents.',
      icon: Paperclip,
      disabled: evidence.length === 0,
    },
    {
      key: 'full-bundle',
      title: 'Full Case Bundle',
      description: 'Rep-ready bundle with cover page, timeline, evidence index, and full records.',
      icon: Package,
      disabled: incidents.length === 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate structured reports ready to share
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Can be used with unions, HR, or legal advisors
        </p>
      </div>

      {/* Case Summary */}
      <div className="px-4 mb-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Case Summary</h3>
              <p className="text-xs text-body mt-0.5">AI-generated narrative combining all incidents, highlighting patterns and recurring individuals.</p>
              
              {caseNarrative ? (
                <div className="mt-3 space-y-3">
                  <div className="mb-1"><AILabel /></div>
                  <h4 className="text-sm font-semibold text-foreground">{caseNarrative.title}</h4>
                  <p className="text-xs text-body">{caseNarrative.overview}</p>
                  
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Chronology</p>
                    <p className="text-xs text-body whitespace-pre-line">{caseNarrative.chronology}</p>
                  </div>

                  {caseNarrative.key_individuals.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-foreground mb-1">Key Individuals</p>
                      <div className="space-y-1">
                        {caseNarrative.key_individuals.map((ind, i) => (
                          <p key={i} className="text-xs text-body">
                            <span className="font-medium">{ind.name}</span> ({ind.involvement_count} incidents) — {ind.context}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Patterns</p>
                    <p className="text-xs text-body">{caseNarrative.patterns_summary}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Impact Summary</p>
                    <p className="text-xs text-body">{caseNarrative.impact_summary}</p>
                  </div>

                  <button onClick={() => setCaseNarrative(null)} className="text-xs text-primary font-medium">
                    Regenerate
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs border-primary text-primary h-9"
                  onClick={handleCaseNarrative}
                  disabled={narrativeLoading || incidents.length < 2}
                >
                  {narrativeLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</> : <><BookOpen className="h-3 w-3 mr-1" /> Generate Case Summary</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {exportTypes.map(({ key, title, description, icon: Icon, disabled }) => (
          <div key={key} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-body mt-0.5">{description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs border-primary text-primary h-9"
                  disabled={disabled || exporting === key}
                  onClick={() => handleExport(key)}
                >
                  {exporting === key ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                  ) : (
                    <><Download className="h-3 w-3 mr-1" /> Generate</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-6 p-3 rounded-lg bg-muted">
        <p className="text-[10px] text-muted-foreground">
          Project Chronicle provides documentation support only — not legal advice. Always consult a qualified employment solicitor or union representative before taking formal action.
        </p>
      </div>
    </div>
  );
};

export default ExportScreen;
