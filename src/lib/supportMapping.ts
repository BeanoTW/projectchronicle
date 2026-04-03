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
  'Communication':             ['workplace'],
  'Action / Change':           ['workplace'],
  'Process Event':             ['workplace'],
  'Pay / Benefits':            ['workplace'],
  'Working Conditions':        ['workplace'],
  'Observed Behaviour':        ['workplace'],
  'Record Issued':             ['workplace'],
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
/*  Signal-based contextual messages for Rights page                  */
/* ------------------------------------------------------------------ */

export interface ContextualSignal {
  id: string;
  message: string;
  guidance: string;
}

export function deriveContextualSignals(incidents: Incident[]): ContextualSignal[] {
  if (incidents.length < 2) return [];
  const signals: ContextualSignal[] = [];

  // Frequency increase check
  const sorted = [...incidents]
    .filter(i => i.incident_date)
    .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());

  if (sorted.length >= 5) {
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      gaps.push(Math.abs(new Date(sorted[i].incident_date).getTime() - new Date(sorted[i + 1].incident_date).getTime()) / 86400000);
    }
    if (gaps.length >= 4) {
      const recentAvg = (gaps[0] + gaps[1]) / 2;
      const earlierAvg = (gaps[2] + gaps[3]) / 2;
      if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) {
        signals.push({
          id: 'ctx-freq',
          message: 'Your recent records show increased activity',
          guidance: 'You may want to keep recording events consistently',
        });
      }
    }
  }

  // Clustering check
  if (sorted.length >= 3) {
    for (let i = 0; i < sorted.length - 2; i++) {
      const span = Math.abs(new Date(sorted[i].incident_date).getTime() - new Date(sorted[i + 2].incident_date).getTime());
      if (span <= 14 * 86400000) {
        signals.push({
          id: 'ctx-cluster',
          message: 'Several incidents occurred close together',
          guidance: 'Recording each event separately helps keep a clear picture',
        });
        break;
      }
    }
  }

  // Repeated person + category
  const personCatPairs: Record<string, number> = {};
  incidents.forEach(i => {
    if (!i.category) return;
    i.people_involved.forEach(p => {
      const key = `${p}::${i.category}`;
      personCatPairs[key] = (personCatPairs[key] || 0) + 1;
    });
  });
  if (Object.values(personCatPairs).some(c => c >= 2)) {
    signals.push({
      id: 'ctx-person-cat',
      message: 'Similar situations involving the same individual appear in your records',
      guidance: 'Noting each occurrence may help show a pattern if needed',
    });
  }

  // Repeated category
  const catCounts: Record<string, number> = {};
  incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  if (Object.values(catCounts).some(c => c >= 3) && !signals.some(s => s.id === 'ctx-person-cat')) {
    signals.push({
      id: 'ctx-repeated-cat',
      message: 'A recurring type of issue appears in your records',
      guidance: 'Understanding your rights around this may be helpful',
    });
  }

  // Weak record strength
  let weakCount = 0;
  incidents.forEach(i => {
    let missing = 0;
    if (i.witnesses.length === 0) missing++;
    if (!i.exact_words) missing++;
    if (!i.impact_note) missing++;
    if (missing >= 2) weakCount++;
  });
  if (weakCount > incidents.length / 2) {
    signals.push({
      id: 'ctx-weak',
      message: 'Adding detail may make patterns easier to understand later',
      guidance: 'Witnesses, wording, and impact notes can strengthen records',
    });
  }

  return signals.slice(0, 3);
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
