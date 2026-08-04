// Chronicle V2 (candidate). filter model. Pure functions over V2Entry.
import type { V2Entry } from './db';
import { emptySummary, type AttachmentType, type EntryMediaSummary } from './media/media';

export type DossierStatus = 'any' | 'included' | 'excluded';

export interface NotebookFilters {
  categories: string[];
  people: string[];
  from: string | null;   // YYYY-MM-DD
  to: string | null;     // YYYY-MM-DD
  dossier: DossierStatus;
  withClarifications: boolean;
  hasVoice: boolean;
  hasAttachments: boolean;
  attachmentTypes: AttachmentType[];
}

export const emptyFilters: NotebookFilters = {
  categories: [],
  people: [],
  from: null,
  to: null,
  dossier: 'any',
  withClarifications: false,
  hasVoice: false,
  hasAttachments: false,
  attachmentTypes: [],
};

export const cloneFilters = (f: NotebookFilters): NotebookFilters => ({
  ...f,
  categories: [...f.categories],
  people: [...f.people],
  attachmentTypes: [...f.attachmentTypes],
});

export const activeFilterCount = (f: NotebookFilters): number =>
  f.categories.length +
  f.people.length +
  (f.from ? 1 : 0) +
  (f.to ? 1 : 0) +
  (f.dossier !== 'any' ? 1 : 0) +
  (f.withClarifications ? 1 : 0) +
  (f.hasVoice ? 1 : 0) +
  (f.hasAttachments ? 1 : 0) +
  f.attachmentTypes.length;

/* Effective date of a record: user-set event date, else the sealed date. */
export const entryDate = (e: V2Entry): string =>
  e.event_date ?? e.sealed_at.slice(0, 10);

export const matchesSearch = (e: V2Entry, term: string): boolean => {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return (
    e.original_text.toLowerCase().includes(t) ||
    (e.title ?? '').toLowerCase().includes(t) ||
    (e.category ?? '').toLowerCase().includes(t) ||
    (e.context ?? '').toLowerCase().includes(t) ||
    e.people.some(p => p.toLowerCase().includes(t)) ||
    e.clarifications.some(c => c.text.toLowerCase().includes(t))
  );
};

export const matchesFilters = (
  e: V2Entry,
  f: NotebookFilters,
  summary: EntryMediaSummary = emptySummary,
): boolean => {
  if (f.categories.length > 0 && !(e.category && f.categories.includes(e.category))) return false;
  if (f.people.length > 0 && !e.people.some(p => f.people.includes(p))) return false;
  const d = entryDate(e);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  if (f.dossier === 'included' && !e.in_dossier) return false;
  if (f.dossier === 'excluded' && e.in_dossier) return false;
  if (f.withClarifications && e.clarifications.length === 0) return false;
  if (f.hasVoice && !summary.hasVoice) return false;
  if (f.hasAttachments && summary.attachmentCount === 0) return false;
  if (f.attachmentTypes.length > 0 && !f.attachmentTypes.some(t => summary.types.includes(t))) return false;
  return true;
};

export interface ActiveChip {
  key: string;
  label: string;
  remove: (f: NotebookFilters) => NotebookFilters;
}

export const buildChips = (f: NotebookFilters): ActiveChip[] => {
  const chips: ActiveChip[] = [];
  f.categories.forEach(c =>
    chips.push({
      key: `cat:${c}`,
      label: c,
      remove: cur => ({ ...cur, categories: cur.categories.filter(x => x !== c) }),
    }),
  );
  f.people.forEach(p =>
    chips.push({
      key: `person:${p}`,
      label: p,
      remove: cur => ({ ...cur, people: cur.people.filter(x => x !== p) }),
    }),
  );
  if (f.from) chips.push({ key: 'from', label: `From ${f.from}`, remove: cur => ({ ...cur, from: null }) });
  if (f.to) chips.push({ key: 'to', label: `To ${f.to}`, remove: cur => ({ ...cur, to: null }) });
  if (f.dossier !== 'any')
    chips.push({
      key: 'dossier',
      label: f.dossier === 'included' ? 'In dossier' : 'Not in dossier',
      remove: cur => ({ ...cur, dossier: 'any' as DossierStatus }),
    });
  if (f.withClarifications)
    chips.push({
      key: 'clar',
      label: 'Has clarifications',
      remove: cur => ({ ...cur, withClarifications: false }),
    });
  if (f.hasVoice)
    chips.push({ key: 'voice', label: 'Has voice record', remove: cur => ({ ...cur, hasVoice: false }) });
  if (f.hasAttachments)
    chips.push({ key: 'att', label: 'Has attachments', remove: cur => ({ ...cur, hasAttachments: false }) });
  f.attachmentTypes.forEach(t =>
    chips.push({
      key: `atype:${t}`,
      label: `${t.charAt(0).toUpperCase()}${t.slice(1)} attachment`,
      remove: cur => ({ ...cur, attachmentTypes: cur.attachmentTypes.filter(x => x !== t) }),
    }),
  );
  return chips;
};

/* Notebook UI state survives navigation to an entry and back (prototype session only). */
export const notebookState: {
  filters: NotebookFilters;
  q: string;
  view: 'list' | 'month';
  month: string; // YYYY-MM
  selectedDate: string | null;
} = {
  filters: cloneFilters(emptyFilters),
  q: '',
  view: 'list',
  month: new Date().toISOString().slice(0, 7),
  selectedDate: null,
};
