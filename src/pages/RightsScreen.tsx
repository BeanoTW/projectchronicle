import { useMemo, useState } from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { useRightsGuidance } from '@/hooks/useRightsGuidance';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import PageHeader from '@/components/chronicle/PageHeader';
import RightsHero from '@/components/chronicle/RightsHero';
import RightsCards from '@/components/chronicle/RightsCards';
import RightsActions from '@/components/chronicle/RightsActions';
import SupportServices from '@/components/chronicle/SupportServices';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import solidarityImg from '@/assets/rights-solidarity.jpg';

const issueTypeMap: Record<string, string[]> = {
  'Management Conduct': ['management conduct', 'leadership accountability'],
  'Verbal Comment': ['workplace communication', 'verbal behaviour'],
  'Written Communication': ['written communication', 'documentation practices'],
  'Safety Concern': ['health and safety', 'duty of care'],
  'Scheduling or Shift Change': ['contractual terms', 'working time'],
  'Disciplinary Meeting': ['disciplinary procedures', 'procedural fairness'],
  'Pay or Payroll Issue': ['pay and remuneration', 'contractual entitlements'],
  'Policy Application': ['workplace policy', 'procedural consistency'],
  'Workplace Meeting': ['workplace communication', 'meeting conduct'],
};

const contextGroups: Record<string, string[]> = {
  'Work': ['Management Conduct', 'Verbal Comment', 'Written Communication', 'Disciplinary Meeting', 'Pay or Payroll Issue', 'Policy Application', 'Workplace Meeting', 'Scheduling or Shift Change'],
  'Personal safety': ['Safety Concern'],
};

const sourceColors: Record<string, string> = {
  'ACAS': 'bg-primary/[0.08] text-primary border border-primary/[0.12]',
  'HSE': 'bg-severity-serious/[0.08] text-severity-serious border border-severity-serious/[0.12]',
  'gov.uk': 'bg-rep text-rep-foreground border border-rep-foreground/[0.12]',
  'Unite': 'bg-severity-low/[0.08] text-severity-low border border-severity-low/[0.12]',
};

const RightsScreen = () => {
  const { data: allGuidance = [], isLoading: guidanceLoading } = useRightsGuidance();
  const { data: incidents = [], isLoading: incidentsLoading } = useIncidents();

  const userCategories = useMemo(() => {
    const cats = new Set<string>();
    incidents.forEach(i => { if (i.category) cats.add(i.category); });
    return cats;
  }, [incidents]);

  const groupedRights = useMemo(() => {
    const groups: Record<string, { category: string; types: string[] }[]> = {};
    userCategories.forEach(cat => {
      const types = issueTypeMap[cat];
      if (!types) return;
      const group = Object.entries(contextGroups).find(([, cats]) => cats.includes(cat));
      const groupName = group ? group[0] : 'General';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({ category: cat, types });
    });
    return groups;
  }, [userCategories]);

  const suggestedActions = useMemo(() => {
    const actions: string[] = [];
    if (incidents.length >= 1) actions.push('Continue recording incidents as they happen');
    if (incidents.length >= 2) actions.push('Consider speaking to a union rep or workplace adviser');
    if (incidents.length >= 3) actions.push('Review Insights to understand what patterns exist');
    if (incidents.length >= 5) actions.push('Use Export to create a summary you can share');
    return actions;
  }, [incidents]);

  const relevantGuidance = allGuidance.filter(r => userCategories.has(r.incident_category));
  const sortedGuidance = [...allGuidance].sort((a, b) => a.display_order - b.display_order);

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

      {/* Hero */}
      <RightsHero />

      {/* Disclaimer */}
      <div className="mx-5 mb-6 px-4 py-2.5 rounded-lg border border-border">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          General information only — not legal advice. Speak to a qualified adviser before taking formal steps.
        </p>
      </div>

      {/* Your Rights — contextual groups */}
      {Object.keys(groupedRights).length > 0 && (
        <div className="mx-5 mb-8">
          <RightsCards groupedRights={groupedRights} relevantGuidance={relevantGuidance} sourceColors={sourceColors} />
        </div>
      )}

      {/* Image break */}
      <div className="mx-5 mb-8 rounded-2xl overflow-hidden relative h-[120px]">
        <img src={solidarityImg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/[0.78] via-background/[0.65] to-background/[0.82]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[14px] font-medium text-foreground/80 tracking-wide">You are not alone in this</p>
        </div>
      </div>

      {/* What you can do */}
      {suggestedActions.length > 0 && (
        <div className="mx-5 mb-8">
          <RightsActions actions={suggestedActions} />
        </div>
      )}

      {/* Browse all guidance */}
      <div className="mx-5 pb-4">
        <Accordion type="single" collapsible className="border-none">
          <AccordionItem value="browse-all" className="border rounded-xl overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline">
              Browse all guidance ({sortedGuidance.length})
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {sortedGuidance.map(r => (
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
