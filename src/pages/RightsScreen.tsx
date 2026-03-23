import { useMemo } from 'react';
import { Shield, ExternalLink, ArrowRight, BookOpen, ChevronDown, FileText, Users, MessageCircle, ShieldCheck, Briefcase } from 'lucide-react';
import { useRightsGuidance } from '@/hooks/useRightsGuidance';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

const guidanceSections = [
  {
    id: 'understanding',
    icon: BookOpen,
    title: 'Understanding your situation',
    points: [
      'Your records help you see what has been happening over time',
      'Look for things that come up more than once — people, types of situations, or timeframes',
      'Understanding your situation is the first step to deciding what to do next',
    ],
  },
  {
    id: 'documenting',
    icon: FileText,
    title: 'How to document clearly',
    points: [
      'Write down what happened as soon as possible after each event',
      'Include dates, times, locations, and who was present',
      'Use exact wording if you remember what was said',
      'Keep your account factual — describe what happened, not how you feel about it',
      'Save any related messages, emails, or documents as evidence',
    ],
  },
  {
    id: 'grievance',
    icon: MessageCircle,
    title: 'Raising a concern or grievance',
    points: [
      'Most workplaces have a grievance or complaints procedure',
      'You can usually raise concerns informally first, then formally if needed',
      'Put your concern in writing so there is a clear record',
      'Keep a copy of everything you send and receive',
      'You can ask for support from a colleague or union representative',
    ],
  },
  {
    id: 'protection',
    icon: ShieldCheck,
    title: 'Protection from unfair treatment',
    points: [
      'Employees have legal protections against unfair treatment at work',
      'If you raise a concern in good faith, you should not be treated worse as a result',
      'Keep records of anything that changes after you raise a concern',
      'If things get worse, this may be relevant to your situation',
    ],
  },
  {
    id: 'speaking',
    icon: Briefcase,
    title: 'Preparing to speak to someone',
    points: [
      'Before meeting HR, a union rep, or an adviser, organise your records',
      'Use the Export feature to create a structured summary of your incidents',
      'Focus on facts — what happened, when, and who was involved',
      'Think about what outcome you would like',
      'You do not need to have all the answers — an adviser can help you work through your options',
    ],
  },
];

const RightsScreen = () => {
  const { data: allGuidance = [], isLoading: guidanceLoading } = useRightsGuidance();
  const { data: incidents = [], isLoading: incidentsLoading } = useIncidents();

  const userCategories = useMemo(() => {
    const cats = new Set<string>();
    incidents.forEach(i => { if (i.category) cats.add(i.category); });
    return cats;
  }, [incidents]);

  const detectedIssueTypes = useMemo(() => {
    const types = new Set<string>();
    userCategories.forEach(cat => {
      const mapped = issueTypeMap[cat];
      if (mapped) mapped.forEach(t => types.add(t));
    });
    return Array.from(types);
  }, [userCategories]);

  const suggestedNextSteps = useMemo(() => {
    const steps: string[] = [];
    if (incidents.length >= 1) steps.push('Continue recording incidents as they happen');
    if (incidents.length >= 3) steps.push('Review the Insights tab to see what's showing up in your records');
    if (incidents.length >= 2) steps.push('Consider speaking to a union representative or workplace adviser');
    if (incidents.length >= 5) steps.push('Use the Export feature to create a structured summary you can share');
    return steps;
  }, [incidents]);

  const relevantGuidance = allGuidance.filter(r => userCategories.has(r.incident_category));
  const sortedGuidance = [...allGuidance].sort((a, b) => a.display_order - b.display_order);

  const sourceColors: Record<string, string> = {
    'ACAS': 'bg-primary/8 text-primary border border-primary/15',
    'HSE': 'bg-severity-serious/8 text-severity-serious border border-severity-serious/15',
    'gov.uk': 'bg-rep text-rep-foreground border border-rep-foreground/15',
    'Unite': 'bg-severity-low/8 text-severity-low border border-severity-low/15',
  };

  if (guidanceLoading || incidentsLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (incidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6"><h1 className="text-xl font-bold text-foreground tracking-tight">Rights</h1></div>
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          heading="No guidance available yet"
          body="Record your first incident and we will show relevant guidance here."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-1">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Rights Guidance</h1>
      </div>

      {/* 1. Intro card */}
      <div className="mx-4 mt-3 mb-3 p-4 rounded-xl bg-primary-light border border-primary/10">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Understanding your situation</p>
            <p className="text-[13px] text-body leading-relaxed">
              This page helps you explore what you've recorded and understand possible next steps. It's designed to support you in organising your thoughts before speaking to someone.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Disclaimer */}
      <div className="mx-4 mb-4 px-4 py-2.5 rounded-lg bg-muted/50 border border-border/60">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This is general information only — not legal advice. Always speak to a qualified adviser before taking formal steps.
        </p>
      </div>

      {/* 3. Guidance sections (accordion) */}
      <div className="mx-4 mb-4">
        <Accordion type="multiple" className="space-y-2">
          {guidanceSections.map(section => {
            const Icon = section.icon;
            return (
              <AccordionItem key={section.id} value={section.id} className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden px-1">
                <AccordionTrigger className="px-3 py-3.5 text-sm font-medium text-foreground hover:no-underline gap-3">
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                    {section.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4">
                  <ul className="space-y-2.5 ml-0.5">
                    {section.points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-[7px]" />
                        <span className="text-[13px] text-body leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* 4. Based on your records */}
      {detectedIssueTypes.length > 0 && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-foreground mb-1.5">Based on your records</h2>
          <p className="text-[11px] text-muted-foreground mb-3">Topics that may be relevant to what you've recorded:</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {detectedIssueTypes.map(type => (
              <span key={type} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/8 text-primary border border-primary/15 capitalize">
                {type}
              </span>
            ))}
          </div>

          {suggestedNextSteps.length > 0 && (
            <div className="pt-3 border-t border-border/60">
              <h3 className="text-xs font-semibold text-foreground mb-2.5">Helpful next steps</h3>
              <div className="space-y-2">
                {suggestedNextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ArrowRight className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-[13px] text-body leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Relevant external guidance */}
      {relevantGuidance.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Relevant to your records</h2>
          <div className="space-y-2.5">
            {relevantGuidance.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceColors[r.source] || 'bg-muted text-muted-foreground'}`}>
                    {r.source}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">{r.title}</h3>
                {r.description && <p className="text-[13px] text-body leading-relaxed mb-2.5">{r.description}</p>}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                  View guidance <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browse all */}
      <div className="px-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Browse all guidance</h2>
        <div className="space-y-2.5">
          {sortedGuidance.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceColors[r.source] || 'bg-muted text-muted-foreground'}`}>
                  {r.source}
                </span>
                <span className="text-[10px] text-muted-foreground">{r.incident_category}</span>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">{r.title}</h3>
              {r.description && <p className="text-[13px] text-body leading-relaxed mb-2.5">{r.description}</p>}
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
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
