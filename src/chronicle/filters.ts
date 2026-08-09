// Chronicle Notebook filter model. Pure, storage-agnostic.
import type { AttachmentType } from './media/mediaCore';

export type DossierStatus = 'any' | 'included' | 'excluded';

/** Chronicle supports two record types. Both are first-class. */
export type RecordTypeFilter = 'incident' | 'daily';

export interface NotebookFilters {
  categories: string[];
  people: string[];
  from: string | null;   // YYYY-MM-DD
  to: string | null;     // YYYY-MM-DD
  dossier: DossierStatus;
  recordTypes: RecordTypeFilter[];
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
  recordTypes: [],
  withClarifications: false,
  hasVoice: false,
  hasAttachments: false,
  attachmentTypes: [],
};

export const cloneFilters = (f: NotebookFilters): NotebookFilters => ({
  ...f,
  categories: [...f.categories],
  people: [...f.people],
  recordTypes: [...f.recordTypes],
  attachmentTypes: [...f.attachmentTypes],
});

export const activeFilterCount = (f: NotebookFilters): number =>
  f.categories.length +
  f.people.length +
  (f.from ? 1 : 0) +
  (f.to ? 1 : 0) +
  (f.dossier !== 'any' ? 1 : 0) +
  f.recordTypes.length +
  (f.withClarifications ? 1 : 0) +
  (f.hasVoice ? 1 : 0) +
  (f.hasAttachments ? 1 : 0) +
  f.attachmentTypes.length;

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
      label: f.dossier === 'included' ? 'In My Record' : 'Not in My Record',
      remove: cur => ({ ...cur, dossier: 'any' as DossierStatus }),
    });
  f.recordTypes.forEach(t =>
    chips.push({
      key: `rtype:${t}`,
      label: t === 'daily' ? 'Daily record' : 'Incident',
      remove: cur => ({ ...cur, recordTypes: cur.recordTypes.filter(x => x !== t) }),
    }),
  );
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

/* Notebook UI state survives navigation to a record and back (session only). */
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
