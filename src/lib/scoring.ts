import type { Tables } from '@/integrations/supabase/types';

type Incident = Tables<'incidents'>;
type Evidence = Tables<'evidence_files'>;

export type EvidenceStrength = 'None' | 'Weak' | 'Moderate' | 'Strong';
export type WitnessSupport = 'None' | 'Limited' | 'Present';
export type DetailCompleteness = 'Basic' | 'Partial' | 'Detailed';
export type RepeatOccurrence = 'One-off' | 'Repeated';
export type RecordStrength = 'Weak' | 'Moderate' | 'Strong';

export interface ScoringResult {
  evidenceStrength: EvidenceStrength;
  witnessSupport: WitnessSupport;
  detailCompleteness: DetailCompleteness;
  repeatOccurrence: RepeatOccurrence;
  recordStrength: RecordStrength;
  recordScore: number;
  strengthPrompts: string[];
  seriousFlag: boolean;
  seriousFlagReason: string | null;
}

const SERIOUS_KEYWORDS = [
  'physical', 'assault', 'attack', 'hit', 'punch', 'shove', 'push', 'grab',
  'sexual', 'grope', 'touching', 'indecent',
  'discriminat', 'racist', 'sexist', 'homophob', 'disab',
  'pregnan', 'maternity', 'paternity',
  'health and safety', 'danger', 'hazard', 'injury', 'injured',
  'safeguard', 'child', 'vulnerable',
  'retaliat', 'reprisal', 'punish', 'victimis',
  'threat', 'intimidat', 'bully',
  'stalk', 'follow', 'harass',
  'theft', 'stolen', 'break-in', 'broke into', 'trespass',
  'damage', 'vandal', 'destroy',
  'drunk', 'spiked', 'drugged',
  'weapon', 'knife', 'armed',
];

function detectSeriousFlag(incident: Incident): { flag: boolean; reason: string | null } {
  const text = [
    incident.raw_narrative,
    incident.exact_words,
    incident.ai_summary,
    incident.impact_note,
  ].filter(Boolean).join(' ').toLowerCase();

  for (const keyword of SERIOUS_KEYWORDS) {
    if (text.includes(keyword)) {
      return { flag: true, reason: 'This record may require urgent review' };
    }
  }
  return { flag: false, reason: null };
}

export function deriveEvidenceStrength(
  evidence: Evidence[],
  incident: Incident
): EvidenceStrength {
  const linked = evidence.filter(e => e.incident_id === incident.id);
  if (linked.length >= 3) return 'Strong';
  if (linked.length >= 1) return 'Moderate';
  if (incident.exact_words) return 'Weak';
  return 'None';
}

export function deriveWitnessSupport(incident: Incident): WitnessSupport {
  if (incident.witnesses.length >= 2) return 'Present';
  if (incident.witnesses.length === 1) return 'Limited';
  return 'None';
}

export function deriveDetailCompleteness(incident: Incident): DetailCompleteness {
  let score = 0;
  if (incident.location) score++;
  if (incident.incident_time) score++;
  if (incident.exact_words) score++;
  if (incident.impact_note) score++;
  if (incident.category) score++;
  if (incident.people_involved.length > 0) score++;
  if (score >= 5) return 'Detailed';
  if (score >= 3) return 'Partial';
  return 'Basic';
}

export function deriveRepeatOccurrence(
  incident: Incident,
  allIncidents: Incident[]
): RepeatOccurrence {
  const sameCategory = allIncidents.filter(
    i => i.id !== incident.id && i.category && i.category === incident.category
  ).length;
  // Require 2+ other records sharing a person (not just 1) to avoid
  // inflating patterns for co-habitants / classmates who appear in every record
  const samePeople = allIncidents.filter(
    i => i.id !== incident.id && i.people_involved.some(p => incident.people_involved.includes(p))
  ).length;
  return sameCategory >= 2 || samePeople >= 2 ? 'Repeated' : 'One-off';
}

const evidenceScores: Record<EvidenceStrength, number> = {
  None: 0, Weak: 1, Moderate: 2, Strong: 3,
};
const witnessScores: Record<WitnessSupport, number> = {
  None: 0, Limited: 1, Present: 2,
};
const detailScores: Record<DetailCompleteness, number> = {
  Basic: 0, Partial: 1, Detailed: 2,
};

export function calculateScoring(
  incident: Incident,
  allIncidents: Incident[],
  allEvidence: Evidence[]
): ScoringResult {
  const evidenceStrength = deriveEvidenceStrength(allEvidence, incident);
  const witnessSupport = deriveWitnessSupport(incident);
  const detailCompleteness = deriveDetailCompleteness(incident);
  const repeatOccurrence = deriveRepeatOccurrence(incident, allIncidents);

  const recordScore =
    evidenceScores[evidenceStrength] +
    witnessScores[witnessSupport] +
    detailScores[detailCompleteness] +
    (repeatOccurrence === 'Repeated' ? 1 : 0);

  const recordStrength: RecordStrength =
    recordScore >= 6 ? 'Strong' : recordScore >= 3 ? 'Moderate' : 'Weak';

  const strengthPrompts: string[] = [];
  const linkedEvidence = allEvidence.filter(e => e.incident_id === incident.id);
  if (linkedEvidence.length === 0) strengthPrompts.push('Add an attachment to strengthen this record');
  if (incident.witnesses.length === 0 || !incident.exact_words || !incident.impact_note) {
    strengthPrompts.push('Add follow-up details to strengthen this record');
  }

  const { flag: seriousFlag, reason: seriousFlagReason } = detectSeriousFlag(incident);

  return {
    evidenceStrength,
    witnessSupport,
    detailCompleteness,
    repeatOccurrence,
    recordStrength,
    recordScore,
    strengthPrompts,
    seriousFlag,
    seriousFlagReason,
  };
}
