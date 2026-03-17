import { useMemo } from 'react';
import { Shield, ExternalLink } from 'lucide-react';
import { useRightsGuidance } from '@/hooks/useRightsGuidance';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';

const RightsScreen = () => {
  const { data: allGuidance = [], isLoading: guidanceLoading } = useRightsGuidance();
  const { data: incidents = [], isLoading: incidentsLoading } = useIncidents();

  const userCategories = useMemo(() => {
    const cats = new Set<string>();
    incidents.forEach(i => { if (i.category) cats.add(i.category); });
    return cats;
  }, [incidents]);

  const relevantGuidance = allGuidance.filter(r => userCategories.has(r.incident_category));
  const sortedGuidance = [...allGuidance].sort((a, b) => a.display_order - b.display_order);

  const sourceColors: Record<string, string> = {
    'ACAS': 'bg-primary/10 text-primary',
    'HSE': 'bg-severity-serious/10 text-severity-serious',
    'gov.uk': 'bg-rep text-rep-foreground',
    'Unite': 'bg-severity-low/10 text-severity-low',
  };

  if (guidanceLoading || incidentsLoading) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (incidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-6"><h1 className="text-2xl font-bold text-foreground">Rights</h1></div>
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          heading="No guidance available yet"
          body="Record your first incident and we will show relevant guidance here."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Rights Guidance</h1>
      </div>

      <div className="mx-4 mb-4 p-3 rounded-lg bg-ai-label/30 border border-ai-label-foreground/20">
        <p className="text-xs text-ai-label-foreground">
          Informational guidance only. Project Chronicle does not provide legal advice. Always consult a qualified adviser.
        </p>
      </div>

      {relevantGuidance.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Relevant to your incidents</h2>
          <div className="space-y-3">
            {relevantGuidance.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceColors[r.source] || 'bg-muted text-muted-foreground'}`}>
                    {r.source}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">{r.title}</h3>
                {r.description && <p className="text-xs text-body mb-2">{r.description}</p>}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                  View guidance <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Browse All Guidance</h2>
        <div className="space-y-3">
          {sortedGuidance.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceColors[r.source] || 'bg-muted text-muted-foreground'}`}>
                  {r.source}
                </span>
                <span className="text-[10px] text-muted-foreground">{r.incident_category}</span>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">{r.title}</h3>
              {r.description && <p className="text-xs text-body mb-2">{r.description}</p>}
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                View guidance <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RightsScreen;
