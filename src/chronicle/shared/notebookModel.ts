// Phase 6B — source-agnostic notebook record model.
//
// Both the V2 preview (Dexie) and the production adapter (local-first
// incidents + follow-up notes) normalise into `NotebookRecord`. The shared
// NotebookView never knows where the data came from.
import type { NotebookFilters, RecordTypeFilter } from '../filters';
import type { AttachmentType } from '../media/mediaCore';

export interface NotebookRecord {
  id: string;
  title: string | null;
  /** Original wording preview (never rewritten). */
  preview: string;
  /** Canonical event/record date, YYYY-MM-DD. Used by date filters + month view. */
  dateKey: string;
  /** Moment the record was sealed/created — shown as date · time. */
  recordedAt: string;
  category: string | null;
  /** Chronicle record type. Daily records stay findable and openable in V2. */
  recordType: RecordTypeFilter;
  /** Free-text extras that search should also match (context, location, subtype…). */
  searchExtras: string[];
  people: string[];
  inDossier: boolean;
  hasClarifications: boolean;
  clarificationCount: number;
  hasVoice: boolean;
  attachmentCount: number;
  attachmentTypes: AttachmentType[];
  /** Extra neutral chips (e.g. record type, status). */
  chips: string[];
}

export const recordMatchesSearch = (r: NotebookRecord, term: string): boolean => {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return (
    r.preview.toLowerCase().includes(t) ||
    (r.title ?? '').toLowerCase().includes(t) ||
    (r.category ?? '').toLowerCase().includes(t) ||
    r.searchExtras.some(x => x.toLowerCase().includes(t)) ||
    r.people.some(p => p.toLowerCase().includes(t))
  );
};

export const recordMatchesFilters = (r: NotebookRecord, f: NotebookFilters): boolean => {
  if (f.categories.length > 0 && !(r.category && f.categories.includes(r.category))) return false;
  if (f.people.length > 0 && !r.people.some(p => f.people.includes(p))) return false;
  if (f.from && r.dateKey < f.from) return false;
  if (f.to && r.dateKey > f.to) return false;
  if (f.dossier === 'included' && !r.inDossier) return false;
  if (f.dossier === 'excluded' && r.inDossier) return false;
  if (f.recordTypes.length > 0 && !f.recordTypes.includes(r.recordType)) return false;
  if (f.withClarifications && !r.hasClarifications) return false;
  if (f.hasVoice && !r.hasVoice) return false;
  if (f.hasAttachments && r.attachmentCount === 0) return false;
  if (f.attachmentTypes.length > 0 && !f.attachmentTypes.some(t => r.attachmentTypes.includes(t))) return false;
  return true;
};

export const sortByRecency = (rows: NotebookRecord[]): NotebookRecord[] =>
  [...rows].sort((a, b) => (b.recordedAt.localeCompare(a.recordedAt)));

/** Records-per-day map for a given YYYY-MM month. */
export const monthCounts = (rows: NotebookRecord[], month: string): Map<string, number> => {
  const map = new Map<string, number>();
  rows.forEach(r => {
    if (r.dateKey.startsWith(month)) map.set(r.dateKey, (map.get(r.dateKey) ?? 0) + 1);
  });
  return map;
};

export const uniqueCategories = (rows: NotebookRecord[]): string[] =>
  Array.from(new Set(rows.map(r => r.category).filter(Boolean) as string[])).sort();

export const uniquePeople = (rows: NotebookRecord[]): string[] =>
  Array.from(new Set(rows.flatMap(r => r.people))).sort();
