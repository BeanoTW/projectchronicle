import type { Tables } from '@/integrations/supabase/types';

type Incident = Tables<'incidents'>;

/* ------------------------------------------------------------------ */
/*  Support service definitions                                       */
/* ------------------------------------------------------------------ */

export interface SupportService {
  id: string;
  name: string;
  description: string;
  url: string;
  context: 'workplace' | 'housing' | 'education' | 'safety' | 'wellbeing' | 'general';
}

const SERVICES: SupportService[] = [
  { id: 'acas', name: 'ACAS', description: 'Free advice on workplace rights and disputes', url: 'https://www.acas.org.uk', context: 'workplace' },
  { id: 'citizens-advice', name: 'Citizens Advice', description: 'Free guidance on a wide range of issues', url: 'https://www.citizensadvice.org.uk', context: 'general' },
  { id: 'shelter', name: 'Shelter', description: 'Housing advice and support', url: 'https://www.shelter.org.uk', context: 'housing' },
  { id: 'student-union', name: 'Student Services', description: 'University support and representation', url: 'https://www.nus.org.uk', context: 'education' },
  { id: 'victim-support', name: 'Victim Support', description: 'Free support for anyone affected by crime', url: 'https://www.victimsupport.org.uk', context: 'safety' },
  { id: 'police-reporting', name: 'Police (non-emergency)', description: 'Report incidents online or call 101', url: 'https://www.police.uk', context: 'safety' },
  { id: 'samaritans', name: 'Samaritans', description: 'Confidential emotional support, 24/7', url: 'https://www.samaritans.org', context: 'wellbeing' },
  { id: 'mind', name: 'Mind', description: 'Mental health information and support', url: 'https://www.mind.org.uk', context: 'wellbeing' },
];

/* ------------------------------------------------------------------ */
/*  Category → context mapping                                        */
/* ------------------------------------------------------------------ */

const CATEGORY_CONTEXT: Record<string, ('workplace' | 'housing' | 'education' | 'safety')[]> = {
  'Management Conduct':        ['workplace'],
  'Verbal Comment':            ['workplace'],
  'Written Communication':     ['workplace'],
  'Disciplinary Meeting':      ['workplace'],
  'Pay or Payroll Issue':      ['workplace'],
  'Policy Application':        ['workplace'],
  'Workplace Meeting':         ['workplace'],
  'Scheduling or Shift Change':['workplace'],
  'Safety Concern':            ['safety'],
  'Noise Complaint':           ['housing'],
  'Property Damage':           ['housing'],
  'Shared Space Dispute':      ['housing'],
  'Accommodation Issue':       ['housing'],
  'Academic Misconduct':       ['education'],
  'Teaching or Supervision':   ['education'],
  'Antisocial Behaviour':      ['safety'],
  'Public Safety':             ['safety'],
  'Transport Incident':        ['safety'],
};

/* ------------------------------------------------------------------ */
/*  Serious-keyword detection                                         */
/* ------------------------------------------------------------------ */

const SAFETY_KEYWORDS = [
  'threat', 'intimidat', 'bully', 'stalk', 'follow', 'harass',
  'physical', 'assault', 'attack', 'hit', 'punch', 'shove', 'grab',
  'sexual', 'grope', 'weapon', 'knife', 'armed',
  'safeguard', 'child', 'vulnerable',
];

function hasSafetyKeywords(incidents: Incident[]): boolean {
  const text = incidents.map(i =>
    [i.raw_narrative, i.exact_words, i.ai_summary, i.impact_note].filter(Boolean).join(' ')
  ).join(' ').toLowerCase();
  return SAFETY_KEYWORDS.some(k => text.includes(k));
}

/* ------------------------------------------------------------------ */
/*  Severity level derivation                                         */
/* ------------------------------------------------------------------ */

export type SeverityLevel = 'low' | 'moderate' | 'high';

export function deriveSeverityLevel(incidents: Incident[]): SeverityLevel {
  if (incidents.length === 0) return 'low';

  const hasSafety = hasSafetyKeywords(incidents);
  if (hasSafety) return 'high';

  const sorted = [...incidents]
    .filter(i => i.incident_date)
    .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());

  if (sorted.length >= 3) {
    for (let i = 0; i <= sorted.length - 3; i++) {
      const span = Math.abs(
        new Date(sorted[i].incident_date).getTime() - new Date(sorted[i + 2].incident_date).getTime()
      );
      if (span <= 14 * 86400000) return 'high';
    }
  }

  if (incidents.length >= 3) return 'moderate';
  if (incidents.length >= 2) {
    const categories = incidents.map(i => i.category).filter(Boolean);
    const hasDuplicate = categories.length !== new Set(categories).size;
    if (hasDuplicate) return 'moderate';
  }

  return 'low';
}

/* ------------------------------------------------------------------ */
/*  Tone messages                                                     */
/* ------------------------------------------------------------------ */

const TONE_MESSAGES: Record<SeverityLevel, string | null> = {
  low: null,
  moderate: 'It may help to speak to someone about this',
  high: 'Support is available if you need it',
};

export function getToneMessage(level: SeverityLevel): string | null {
  return TONE_MESSAGES[level];
}

/* ------------------------------------------------------------------ */
/*  Service selection                                                 */
/* ------------------------------------------------------------------ */

export function selectServices(incidents: Incident[]): SupportService[] {
  if (incidents.length === 0) return [];

  const neededContexts = new Set<string>();

  incidents.forEach(i => {
    const contexts = i.category ? CATEGORY_CONTEXT[i.category] : undefined;
    if (contexts) contexts.forEach(c => neededContexts.add(c));
  });

  if (hasSafetyKeywords(incidents)) {
    neededContexts.add('safety');
  }

  const severity = deriveSeverityLevel(incidents);
  if (severity === 'high' || incidents.length >= 5) {
    neededContexts.add('wellbeing');
  }

  neededContexts.add('general');

  const selected = SERVICES.filter(s => neededContexts.has(s.context));
  const unique = selected.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
  return unique.slice(0, 5);
}
