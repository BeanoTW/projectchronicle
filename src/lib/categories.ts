/**
 * Global Category System — Single Source of Truth
 * Two-layer model: Primary Category + Subtype
 *
 * LOCKED — do not add, rename, or merge categories or subtypes.
 */

// ─── Primary Categories ──────────────────────────────────────

export const PRIMARY_CATEGORIES = [
  'Verbal Comment',
  'Non-Verbal Behaviour',
  'Written Communication',
  'Work Allocation',
  'Process / Procedure',
  'Management Handling',
  'Safety / Operational',
  'Unclassified',
] as const;

export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

// ─── Subtypes (scoped to category) ──────────────────────────

export const SUBTYPES: Record<PrimaryCategory, readonly string[]> = {
  'Verbal Comment': ['Statement', 'Instruction', 'Confrontation', 'Joke / Informal Remark', 'Other'],
  'Non-Verbal Behaviour': ['Gesture / Expression', 'Physical Action', 'Exclusion Behaviour', 'Presence / Absence Behaviour', 'Other'],
  'Written Communication': ['Message', 'Formal Communication', 'Recorded System Entry', 'Other'],
  'Work Allocation': ['Task Assignment', 'Task Removal', 'Unequal Distribution', 'Role Change', 'Other'],
  'Process / Procedure': ['Disciplinary Process', 'Grievance Process', 'Policy Application', 'Decision Outcome', 'Other'],
  'Management Handling': ['No Action Taken', 'Dismissive Response', 'Escalation Action', 'Delayed Response', 'Other'],
  'Safety / Operational': ['Unsafe Condition', 'Equipment Issue', 'Staffing Issue', 'Environmental Risk', 'Other'],
  'Unclassified': ['Unclassified'],
} as const;

export type Subtype = (typeof SUBTYPES)[PrimaryCategory][number];

// ─── Definitions ────────────────────────────────────────────

export const CATEGORY_DEFINITIONS: Record<PrimaryCategory, { definition: string; includes: string; excludes: string }> = {
  'Verbal Comment': {
    definition: 'Spoken words directed at or around the user.',
    includes: 'remarks, instructions, conversations',
    excludes: 'written messages, physical actions',
  },
  'Non-Verbal Behaviour': {
    definition: 'Observable actions without spoken or written words.',
    includes: 'gestures, physical behaviour, exclusion',
    excludes: 'anything spoken or written',
  },
  'Written Communication': {
    definition: 'Any recorded or digital communication where the communication itself is the primary behaviour.',
    includes: 'messages, emails, documents, logs',
    excludes: 'situations where writing is only the delivery method for another behaviour',
  },
  'Work Allocation': {
    definition: 'Assignment, removal, or distribution of work tasks or responsibilities.',
    includes: 'duties, workload, role expectations',
    excludes: 'general communication about work',
  },
  'Process / Procedure': {
    definition: 'Application or execution of a formal or informal process.',
    includes: 'disciplinary, grievance, policy use, procedural decisions',
    excludes: 'general managerial responses outside a process',
  },
  'Management Handling': {
    definition: 'How a person in authority responds to a situation, concern, or incident outside the process itself.',
    includes: 'action, inaction, dismissal, escalation, delay',
    excludes: 'formal procedural steps or policy execution',
  },
  'Safety / Operational': {
    definition: 'Conditions affecting safety or operational functioning.',
    includes: 'risks, environment, equipment, staffing',
    excludes: 'interpersonal behaviour',
  },
  'Unclassified': {
    definition: 'Used only when no category reasonably applies.',
    includes: 'uncategorisable events',
    excludes: 'anything classifiable under other categories',
  },
};

// ─── Priority Order (tie-breaker) ───────────────────────────

export const CATEGORY_PRIORITY: PrimaryCategory[] = [
  'Written Communication',
  'Verbal Comment',
  'Work Allocation',
  'Process / Procedure',
  'Management Handling',
  'Safety / Operational',
  'Non-Verbal Behaviour',
  'Unclassified',
];

// ─── Trigger keywords for AI classification ─────────────────

export const CATEGORY_TRIGGERS: Record<PrimaryCategory, string[]> = {
  'Verbal Comment': ['said', 'told', 'asked', 'called', 'spoke', 'shouted', 'whispered', 'remarked', 'commented', 'instructed', 'conversation'],
  'Non-Verbal Behaviour': ['gesture', 'stared', 'ignored', 'excluded', 'walked away', 'slammed', 'pushed', 'shoved', 'blocked', 'stood over', 'looked at'],
  'Written Communication': ['email', 'emailed', 'messaged', 'text', 'letter', 'wrote', 'written', 'logged', 'recorded', 'HR system', 'posted', 'notice'],
  'Work Allocation': ['assigned', 'removed', 'taken off', 'rota', 'shift', 'workload', 'duties', 'role', 'responsibility', 'moved', 'transferred', 'reassigned'],
  'Process / Procedure': ['meeting', 'grievance', 'disciplinary', 'hearing', 'investigation', 'review', 'process', 'procedure', 'policy', 'formal'],
  'Management Handling': ['no action', 'ignored', 'dismissed', 'nothing done', 'delayed', 'escalated', 'refused', 'failed to', 'did not respond', 'inaction'],
  'Safety / Operational': ['unsafe', 'risk', 'equipment', 'staffing', 'temperature', 'hazard', 'injury', 'broken', 'PPE', 'health and safety', 'conditions'],
  'Unclassified': [],
};

// ─── UI Styling ─────────────────────────────────────────────

/** CategoryBadge tints */
export const CATEGORY_BADGE_TINTS: Record<PrimaryCategory, string> = {
  'Verbal Comment': 'bg-primary/8 text-primary border-primary/15',
  'Non-Verbal Behaviour': 'bg-info/8 text-info border-info/15',
  'Written Communication': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Work Allocation': 'bg-secondary text-secondary-foreground border-secondary-foreground/15',
  'Process / Procedure': 'bg-muted text-muted-foreground border-border',
  'Management Handling': 'bg-destructive/8 text-destructive border-destructive/15',
  'Safety / Operational': 'bg-severity-serious/8 text-severity-serious border-severity-serious/15',
  'Unclassified': 'bg-accent/80 text-accent-foreground border-accent-foreground/10',
};

/** IncidentCard left-border tints */
export const CATEGORY_CARD_TINTS: Record<PrimaryCategory, string> = {
  'Verbal Comment': 'border-l-primary/40 bg-primary/[0.02]',
  'Non-Verbal Behaviour': 'border-l-info/30 bg-info/[0.02]',
  'Written Communication': 'border-l-warm-accent/40 bg-warm-accent/[0.03]',
  'Work Allocation': 'border-l-secondary-foreground/25 bg-secondary/30',
  'Process / Procedure': 'border-l-muted-foreground/25 bg-muted/30',
  'Management Handling': 'border-l-destructive/30 bg-destructive/[0.02]',
  'Safety / Operational': 'border-l-severity-serious/30 bg-severity-serious/[0.02]',
  'Unclassified': 'border-l-muted-foreground/20 bg-muted/20',
};

/** NarrativeDayView left-border colours */
export const CATEGORY_BORDER_COLORS: Record<string, string> = {
  'Verbal Comment': 'border-l-primary',
  'Written Communication': 'border-l-warm-accent',
  'Work Allocation': 'border-l-secondary-foreground',
  'Process / Procedure': 'border-l-muted-foreground',
  'Management Handling': 'border-l-destructive',
  'Safety / Operational': 'border-l-severity-serious',
  'Non-Verbal Behaviour': 'border-l-info',
  'Unclassified': 'border-l-muted-foreground/40',
};

/** Summary display names (lowercase) */
export const CATEGORY_LABELS: Record<PrimaryCategory, string> = {
  'Verbal Comment': 'verbal comment',
  'Non-Verbal Behaviour': 'non-verbal behaviour',
  'Written Communication': 'written communication',
  'Work Allocation': 'work allocation',
  'Process / Procedure': 'process / procedure',
  'Management Handling': 'management handling',
  'Safety / Operational': 'safety / operational',
  'Unclassified': 'unclassified',
};

// ─── Old → New category migration map ───────────────────────

export const LEGACY_CATEGORY_MAP: Record<string, PrimaryCategory> = {
  'Communication': 'Verbal Comment',
  'Action / Change': 'Work Allocation',
  'Process Event': 'Process / Procedure',
  'Pay / Benefits': 'Work Allocation',
  'Working Conditions': 'Safety / Operational',
  'Observed Behaviour': 'Non-Verbal Behaviour',
  'Record Issued': 'Written Communication',
};

/** Resolve any category string (legacy or current) to a valid PrimaryCategory */
export function resolveCategory(raw: string | null | undefined): PrimaryCategory {
  if (!raw) return 'Unclassified';
  if (PRIMARY_CATEGORIES.includes(raw as PrimaryCategory)) return raw as PrimaryCategory;
  if (raw === 'Other') return 'Unclassified';
  return LEGACY_CATEGORY_MAP[raw] || 'Unclassified';
}

/** Get valid subtypes for a category */
export function getSubtypes(category: PrimaryCategory): readonly string[] {
  return SUBTYPES[category] || ['Unclassified'];
}
