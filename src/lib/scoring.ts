import type { Tables } from '@/integrations/supabase/types';

type Incident = Tables<'incidents'>;
type Evidence = Tables<'evidence_files'>;

export type ImpactLevel = 'Minor' | 'Moderate' | 'Significant' | 'Severe';
export type FrequencyLevel = 'One-off' | 'Repeated';
export type IntentLevel = 'Accidental' | 'Negligent' | 'Deliberate';
export type EvidenceStrength = 'None' | 'Weak' | 'Moderate' | 'Strong';
export type RecordStrength = 'Weak' | 'Moderate' | 'Strong';
export type EscalationRisk = 'Low' | 'Medium' | 'High';

export interface ScoringResult {
  impact: ImpactLevel;
  frequency: FrequencyLevel;
  intent: IntentLevel;
  evidenceStrength: EvidenceStrength;
  recordStrength: RecordStrength;
  escalationRisk: EscalationRisk;
  recordScore: number;
  escalationScore: number;
  strengthPrompts: string[];
}

const impactScores: Record<ImpactLevel, number> = {
  Minor: 1, Moderate: 2, Significant: 3, Severe: 4,
};

const frequencyScores: Record<FrequencyLevel, number> = {
  'One-off': 1, Repeated: 3,
};

const intentScores: Record<IntentLevel, number> = {
  Accidental: 1, Negligent: 2, Deliberate: 3,
};

const evidenceScores: Record<EvidenceStrength, number> = {
  None: 0, Weak: 1, Moderate: 2, Strong: 3,
};

export function deriveImpact(severity: string | null): ImpactLevel {
  switch (severity) {
    case 'Critical': return 'Severe';
    case 'Serious': return 'Significant';
    case 'Moderate': return 'Moderate';
    default: return 'Minor';
  }
}

export function deriveFrequency(
  incident: Incident,
  allIncidents: Incident[]
): FrequencyLevel {
  // Check if same people or same category appear in 2+ other incidents
  const sameCategory = allIncidents.filter(
    i => i.id !== incident.id && i.category && i.category === incident.category
  ).length;
  const samePeople = allIncidents.filter(
    i => i.id !== incident.id && i.people_involved.some(p => incident.people_involved.includes(p))
  ).length;
  return sameCategory >= 2 || samePeople >= 1 ? 'Repeated' : 'One-off';
}

export function deriveIntent(severity: string | null, category: string | null): IntentLevel {
  if (severity === 'Critical' || severity === 'Serious') return 'Deliberate';
  if (category === 'Safety Concern' || category === 'Scheduling or Shift Change') return 'Negligent';
  return 'Accidental';
}

export function deriveEvidenceStrength(
  evidence: Evidence[],
  incident: Incident
): EvidenceStrength {
  const linkedEvidence = evidence.filter(e => e.incident_id === incident.id);
  const hasWitnesses = incident.witnesses.length > 0;
  const hasExactWords = !!incident.exact_words;

  const points = linkedEvidence.length * 2 + (hasWitnesses ? 2 : 0) + (hasExactWords ? 1 : 0);
  if (points >= 5) return 'Strong';
  if (points >= 3) return 'Moderate';
  if (points >= 1) return 'Weak';
  return 'None';
}

export function calculateScoring(
  incident: Incident,
  allIncidents: Incident[],
  allEvidence: Evidence[]
): ScoringResult {
  const impact = deriveImpact(incident.severity);
  const frequency = deriveFrequency(incident, allIncidents);
  const intent = deriveIntent(incident.severity, incident.category);
  const evidenceStrength = deriveEvidenceStrength(allEvidence, incident);

  // Record Strength: evidence + witnesses + documentation quality
  const recordScore = evidenceScores[evidenceStrength] * 2 +
    (incident.witnesses.length >= 1 ? 2 : 0) +
    (incident.exact_words ? 1 : 0) +
    (incident.location ? 1 : 0) +
    (incident.impact_note ? 1 : 0);
  
  const recordStrength: RecordStrength =
    recordScore >= 7 ? 'Strong' : recordScore >= 3 ? 'Moderate' : 'Weak';

  // Escalation Risk: impact + frequency + intent
  const escalationScore =
    impactScores[impact] + frequencyScores[frequency] + intentScores[intent];
  
  const escalationRisk: EscalationRisk =
    escalationScore >= 8 ? 'High' : escalationScore >= 5 ? 'Medium' : 'Low';

  // Strength prompts
  const strengthPrompts: string[] = [];
  const linkedEvidence = allEvidence.filter(e => e.incident_id === incident.id);
  if (linkedEvidence.length === 0) strengthPrompts.push('Add evidence to strengthen this record');
  if (incident.witnesses.length === 0) strengthPrompts.push('Add witnesses if available');
  if (!incident.exact_words) strengthPrompts.push('Record exact wording if possible');
  if (!incident.impact_note) strengthPrompts.push('Note the impact this had on you');

  return {
    impact, frequency, intent, evidenceStrength,
    recordStrength, escalationRisk,
    recordScore, escalationScore,
    strengthPrompts,
  };
}
