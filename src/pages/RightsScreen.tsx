import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { useRightsGuidance } from '@/hooks/useRightsGuidance';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import PageHeader from '@/components/chronicle/PageHeader';
import RightsHero from '@/components/chronicle/RightsHero';
import RightsActions from '@/components/chronicle/RightsActions';
import RightsContextualSignals from '@/components/chronicle/RightsContextualSignals';
import SupportServices from '@/components/chronicle/SupportServices';
import MentalHealthSection from '@/components/chronicle/MentalHealthSection';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import solidarityImg from '@/assets/rights-solidarity.jpg';

const sourceColors: Record<string, string> = {
  'ACAS': 'bg-primary/[0.08] text-primary border border-primary/[0.12]',
  'HSE': 'bg-severity-serious/[0.08] text-severity-serious border border-severity-serious/[0.12]',
  'gov.uk': 'bg-rep text-rep-foreground border border-rep-foreground/[0.12]',
  'Unite': 'bg-severity-low/[0.08] text-severity-low border border-severity-low/[0.12]',
  'NHS': 'bg-info/[0.08] text-info border border-info/[0.12]',
};

const RightsScreen = () => {
  const { data: allGuidance = [], isLoading: guidanceLoading } = useRightsGuidance();
  const { data: incidents = [], isLoading: incidentsLoading } = useIncidents();

  const userCategories = useMemo(() => {
    const cats = new Set<string>();
    incidents.forEach(i => { if (i.category) cats.add(i.category); });
    return cats;
  }, [incidents]);

  const relevantGuidance = allGuidance.filter(r => userCategories.has(r.incident_category));

  const workCategories = [
    'Management Conduct', 'Verbal Comment', 'Written Communication',
    'Disciplinary Meeting', 'Pay or Payroll Issue', 'Policy Application',
    'Workplace Meeting', 'Scheduling or Shift Change', 'Safety Concern',
  ];
  const workGuidance = allGuidance.filter(r => workCategories.includes(r.incident_category));

  const suggestedActions = useMemo(() => {
    const actions: string[] = [];
    if (incidents.length >= 1) actions.push('Continue recording incidents as they happen');
    if (incidents.length >= 2) actions.push('Consider speaking to a union rep or workplace adviser');
    if (incidents.length >= 3) actions.push('Review Insights to understand what patterns exist');
    if (incidents.length >= 5) actions.push('Use Export to create a summary you can share');
    return actions;
  }, [incidents]);

  const deduplicatedGuidance = useMemo(() => {
    const seen = new Set<string>();
    return [...allGuidance]
      .sort((a, b) => a.display_order - b.display_order)
      .filter(r => {
        const key = `${r.source}-${r.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [allGuidance]);

  if (guidanceLoading || incidentsLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (incidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8"><h1>Rights & Guidance</h1></div>
        <EmptyState icon={<ChronicleLogo size={48} />} heading="No guidance available yet" body="Record your first incident and relevant guidance will appear here." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Rights & Guidance" />

      {/* 1. Hero */}
      <RightsHero />

      {/* Disclaimer */}
      <div className="mx-5 mb-7 px-4 py-2.5 rounded-lg border border-border">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          General information only — not legal advice. Speak to a qualified adviser before taking formal steps.
        </p>
      </div>

      {/* 2. Relevant to your records */}
      {relevantGuidance.length > 0 && (
        <div className="mx-5 mb-8">
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Relevant to your records
          </p>
          <div className="space-y-3">
            {relevantGuidance.slice(0, 6).map(g => (
              <div key={g.id} className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColors[g.source] || 'bg-muted text-muted-foreground'}`}>
                    {g.source}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">{g.incident_category}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-foreground leading-snug mb-0.5">{g.title}</h3>
                {g.description && (
                  <p className="text-[13px] text-muted-foreground/80 leading-relaxed line-clamp-2 mb-2">{g.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground/50 italic mb-2">
                  Shown because this relates to your records
                </p>
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary font-medium hover:underline">
                  View guidance <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Contextual signals — "What this may help with" */}
      <div className="mx-5 mb-8">
        <RightsContextualSignals incidents={incidents} />
      </div>

      {/* Image break */}
      <div className="mx-5 mb-8 rounded-2xl overflow-hidden relative h-[120px]">
        <img src={solidarityImg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/[0.78] via-background/[0.65] to-background/[0.82]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[14px] font-medium text-foreground/80 tracking-wide">You are not alone in this</p>
        </div>
      </div>

      {/* 4. Get support */}
      <div className="mx-5 mb-8">
        <SupportServices incidents={incidents} />
      </div>

      {/* 5. Work guidance */}
      {workGuidance.length > 0 && (
        <div className="mx-5 mb-8">
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Work
          </p>
          <div className="space-y-2">
            {workGuidance.slice(0, 5).map(g => (
              <a
                key={g.id}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sourceColors[g.source] || 'bg-muted text-muted-foreground'}`}>
                    {g.source}
                  </span>
                  <span className="text-[13px] text-foreground group-hover:underline line-clamp-1">{g.title}</span>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 ml-2" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 6. Mental health & wellbeing */}
      <div className="mx-5 mb-8">
        <MentalHealthSection />
      </div>

      {/* 7. What you can do */}
      {suggestedActions.length > 0 && (
        <div className="mx-5 mb-8">
          <RightsActions actions={suggestedActions} />
        </div>
      )}

      {/* 8. Browse all guidance */}
      <div className="mx-5 pb-4">
        <Accordion type="single" collapsible className="border-none">
          <AccordionItem value="browse-all" className="border rounded-xl overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-4 text-[14px] font-semibold text-foreground hover:no-underline">
              Browse all guidance ({deduplicatedGuidance.length})
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {deduplicatedGuidance.map(r => (
                  <div key={r.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sourceColors[r.source] || 'bg-muted text-muted-foreground'}`}>
                        {r.source}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60">{r.incident_category}</span>
                    </div>
                    <h3 className="text-[13px] font-medium text-foreground mb-0.5">{r.title}</h3>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary font-medium hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default RightsScreen;
