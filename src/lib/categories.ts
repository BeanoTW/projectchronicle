/**
 * Global Category System — Single Source of Truth
 * Two-layer model: Primary Category + Subtype
 *
 * V4.3 — Behaviour-based classification system
 */

// ─── Primary Categories ──────────────────────────────────────

export const PRIMARY_CATEGORIES = [
  'Communication',
  'Action / Change',
  'Process Event',
  'Pay / Benefits',
  'Working Conditions',
  'Observed Behaviour',
  'Record Issued',
  'Other',
] as const;

export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

// ─── Subtypes (scoped to category) ──────────────────────────

export const SUBTYPES: Record<PrimaryCategory, readonly string[]> = {
  'Communication': [
    'Verbal statement',
    'Written message',
    'Email',
    'Public statement',
    'Internal communication',
    'Instruction given',
    'Unclassified',
  ],
  'Action / Change': [
    'Shift removed',
    'Shift added',
    'Role changed',
    'Duties reassigned',
    'Access revoked',
    'Access granted',
    'Location changed',
    'Schedule altered',
    'Unclassified',
  ],
  'Process Event': [
    'Meeting held',
    'Meeting scheduled',
    'Investigation started',
    'Investigation ongoing',
    'Outcome issued',
    'Appeal submitted',
    'Appeal outcome issued',
    'Formal notice given',
    'Unclassified',
  ],
  'Pay / Benefits': [
    'Pay change',
    'Pay withheld',
    'Bonus / commission change',
    'Holiday / leave issue',
    'Sick pay issue',
    'Expenses issue',
    'Unclassified',
  ],
  'Working Conditions': [
    'Unsafe condition',
    'Equipment issue',
    'Staffing level issue',
    'Workload level change',
    'Break / rest issue',
    'Temperature / environment issue',
    'Unclassified',
  ],
  'Observed Behaviour': [
    'Tone / manner',
    'Ignored / no response',
    'Exclusion from activity',
    'Unequal treatment (observed difference)',
    'Repeated behaviour',
    'Physical gesture / conduct',
    'Unclassified',
  ],
  'Record Issued': [
    'Warning issued',
    'Written record created',
    'Policy document provided',
    'Contract / terms issued',
    'Notes recorded',
    'Unclassified',
  ],
  'Other': ['Unclassified'],
} as const;

export type Subtype = (typeof SUBTYPES)[PrimaryCategory][number];

// ─── Definitions ────────────────────────────────────────────

export const CATEGORY_DEFINITIONS: Record<PrimaryCategory, { definition: string; includes: string; excludes: string }> = {
  'Communication': {
    definition: 'Spoken or written words directed at or around the user.',
    includes: 'remarks, instructions, conversations, messages, emails',
    excludes: 'physical actions, process outcomes',
  },
  'Action / Change': {
    definition: 'Assignment, removal, or distribution of work tasks, responsibilities, or conditions.',
    includes: 'shifts, duties, role changes, access changes',
    excludes: 'general communication about work',
  },
  'Process Event': {
    definition: 'Application or execution of a formal or informal process.',
    includes: 'meetings, hearings, investigations, outcomes, appeals',
    excludes: 'general managerial responses outside a process',
  },
  'Pay / Benefits': {
    definition: 'Changes or issues relating to pay, benefits, or financial entitlements.',
    includes: 'pay, bonuses, holiday, sick pay, expenses',
    excludes: 'general working conditions',
  },
  'Working Conditions': {
    definition: 'Conditions affecting safety, environment, or operational functioning.',
    includes: 'risks, equipment, staffing, workload, breaks, environment',
    excludes: 'interpersonal behaviour',
  },
  'Observed Behaviour': {
    definition: 'Observable behaviour or conduct directed at or around the user.',
    includes: 'tone, exclusion, ignoring, gestures, unequal treatment',
    excludes: 'anything spoken or written as the primary behaviour',
  },
  'Record Issued': {
    definition: 'A formal record, notice, or document issued to the user.',
    includes: 'warnings, written records, policy documents, contracts',
    excludes: 'informal communication',
  },
  'Other': {
    definition: 'Used only when no category reasonably applies.',
    includes: 'uncategorisable events',
    excludes: 'anything classifiable under other categories',
  },
};

// ─── Priority Order (tie-breaker) ───────────────────────────

export const CATEGORY_PRIORITY: PrimaryCategory[] = [
  'Record Issued',
  'Process Event',
  'Action / Change',
  'Pay / Benefits',
  'Working Conditions',
  'Communication',
  'Observed Behaviour',
  'Other',
];

// ─── Trigger keywords for AI classification ─────────────────

export const CATEGORY_TRIGGERS: Record<PrimaryCategory, string[]> = {
  'Communication': ['said', 'told', 'asked', 'called', 'spoke', 'shouted', 'whispered', 'remarked', 'commented', 'instructed', 'conversation', 'email', 'emailed', 'messaged', 'text', 'wrote', 'written'],
  'Action / Change': ['assigned', 'removed', 'taken off', 'rota', 'shift', 'workload', 'duties', 'role', 'responsibility', 'moved', 'transferred', 'reassigned', 'access revoked', 'access granted'],
  'Process Event': ['meeting', 'grievance', 'disciplinary', 'hearing', 'investigation', 'review', 'process', 'procedure', 'policy', 'formal', 'appeal', 'outcome'],
  'Pay / Benefits': ['pay', 'salary', 'wage', 'bonus', 'commission', 'holiday', 'leave', 'sick pay', 'expenses', 'benefits'],
  'Working Conditions': ['unsafe', 'risk', 'equipment', 'staffing', 'temperature', 'hazard', 'injury', 'broken', 'PPE', 'health and safety', 'conditions', 'workload', 'break', 'rest'],
  'Observed Behaviour': ['gesture', 'stared', 'ignored', 'excluded', 'walked away', 'slammed', 'pushed', 'shoved', 'blocked', 'stood over', 'looked at', 'tone', 'manner'],
  'Record Issued': ['warning', 'written record', 'policy document', 'contract', 'terms issued', 'notes recorded', 'formal notice', 'letter'],
  'Other': [],
};

// ─── UI Styling ─────────────────────────────────────────────

/** CategoryBadge tints */
export const CATEGORY_BADGE_TINTS: Record<PrimaryCategory, string> = {
  'Communication': 'bg-primary/8 text-primary border-primary/15',
  'Observed Behaviour': 'bg-info/8 text-info border-info/15',
  'Record Issued': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Action / Change': 'bg-secondary text-secondary-foreground border-secondary-foreground/15',
  'Process Event': 'bg-muted text-muted-foreground border-border',
  'Pay / Benefits': 'bg-destructive/8 text-destructive border-destructive/15',
  'Working Conditions': 'bg-severity-serious/8 text-severity-serious border-severity-serious/15',
  'Other': 'bg-accent/80 text-accent-foreground border-accent-foreground/10',
};

/** IncidentCard left-border tints */
export const CATEGORY_CARD_TINTS: Record<PrimaryCategory, string> = {
  'Communication': 'border-l-primary/40 bg-primary/[0.02]',
  'Observed Behaviour': 'border-l-info/30 bg-info/[0.02]',
  'Record Issued': 'border-l-warm-accent/40 bg-warm-accent/[0.03]',
  'Action / Change': 'border-l-secondary-foreground/25 bg-secondary/30',
  'Process Event': 'border-l-muted-foreground/25 bg-muted/30',
  'Pay / Benefits': 'border-l-destructive/30 bg-destructive/[0.02]',
  'Working Conditions': 'border-l-severity-serious/30 bg-severity-serious/[0.02]',
  'Other': 'border-l-muted-foreground/20 bg-muted/20',
};

/** NarrativeDayView left-border colours */
export const CATEGORY_BORDER_COLORS: Record<string, string> = {
  'Communication': 'border-l-primary',
  'Record Issued': 'border-l-warm-accent',
  'Action / Change': 'border-l-secondary-foreground',
  'Process Event': 'border-l-muted-foreground',
  'Pay / Benefits': 'border-l-destructive',
  'Working Conditions': 'border-l-severity-serious',
  'Observed Behaviour': 'border-l-info',
  'Other': 'border-l-muted-foreground/40',
};

/** Summary display names (lowercase) */
export const CATEGORY_LABELS: Record<PrimaryCategory, string> = {
  'Communication': 'communication',
  'Observed Behaviour': 'observed behaviour',
  'Record Issued': 'record issued',
  'Action / Change': 'action / change',
  'Process Event': 'process event',
  'Pay / Benefits': 'pay / benefits',
  'Working Conditions': 'working conditions',
  'Other': 'other',
};

// ─── Old → New category migration map ───────────────────────

export const LEGACY_CATEGORY_MAP: Record<string, PrimaryCategory> = {
  // Previous v3 system → v4.3
  'Verbal Comment': 'Communication',
  'Non-Verbal Behaviour': 'Observed Behaviour',
  'Written Communication': 'Communication',
  'Work Allocation': 'Action / Change',
  'Process / Procedure': 'Process Event',
  'Management Handling': 'Observed Behaviour',
  'Safety / Operational': 'Working Conditions',
  'Unclassified': 'Other',
};

/** Resolve any category string (legacy or current) to a valid PrimaryCategory */
export function resolveCategory(raw: string | null | undefined): PrimaryCategory {
  if (!raw) return 'Other';
  if (PRIMARY_CATEGORIES.includes(raw as PrimaryCategory)) return raw as PrimaryCategory;
  if (raw === 'Unclassified') return 'Other';
  return LEGACY_CATEGORY_MAP[raw] || 'Other';
}

/** Get valid subtypes for a category */
export function getSubtypes(category: PrimaryCategory): readonly string[] {
  return SUBTYPES[category] || ['Unclassified'];
}

// ─── Context Domain ─────────────────────────────────────────

export const CONTEXT_DOMAINS = [
  'Workplace',
  'Education',
  'Home / Domestic',
  'Public / Social',
  'Online / Digital',
  'Other',
  'Unknown',
] as const;

export type ContextDomain = (typeof CONTEXT_DOMAINS)[number];
