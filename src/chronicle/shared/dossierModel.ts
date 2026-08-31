// Phase 6D — source-agnostic dossier model.
//
// Both the V2 preview (Dexie `chronicle_prototype`) and production (local-first
// incidents + follow-up notes + Supabase evidence) normalise into the source
// types below. Nothing in this module imports Dexie, Supabase or React.
import { attachmentType, formatBytes, formatDuration, typeLabel, type AttachmentType } from '../media/mediaCore';

/* ---------- Source types (what an adapter must produce) ---------- */

export interface DossierSourceRecord {
  id: string;
  title: string | null;
  /** Original wording, exactly as sealed. Never rewritten. */
  original_text: string;
  sealed_at: string;            // ISO
  captured_at: string;          // ISO
  event_date: string | null;    // YYYY-MM-DD
  event_time: string | null;
  category: string | null;
  context: string | null;
  people: string[];
  clarifications: Array<{ id: string; text: string; created_at: string }>;
  /** Canonical inclusion. Production maps this from `!excluded_from_rep`. */
  in_dossier: boolean;
}

export interface DossierSourceMedia {
  id: string;
  entry_id: string;
  kind: 'voice' | 'attachment';
  /** Legacy media remains unresolved unless Chronicle has positive provenance. */
  role: 'original' | 'later' | 'legacy_unresolved';
  name: string;
  mime: string;
  size: number;
  duration_ms: number | null;
  description: string | null;
  added_at: string;
  excluded_from_dossier: boolean;
}

/**
 * What a screen must supply for `DossierView` to render and export. Both the V2
 * local adapter and the production adapter satisfy this contract; the view
 * itself stays free of Dexie, Supabase and React-query specifics.
 */
export interface DossierAdapter {
  loading: boolean;
  records: DossierSourceRecord[];
  media: DossierSourceMedia[];
  /** Inclusion membership only; never alters sealed original wording. */
  setIncluded: (recordId: string, included: boolean) => Promise<void>;
  /** Resolves raw bytes for one media item at export time, or null if absent. */
  loadBlob: (mediaId: string) => Promise<Blob | null>;
  /** React hook used inside the preview to resolve a displayable media URL. */
  useMediaUrl?: (item: DossierEvidenceItem) => string | null;
  /** Optional plain note shown when evidence availability is limited. */
  evidenceNote?: string | null;
}

/* ---------- Configuration ---------- */

export interface DossierConfig {
  title: string;
  /* Preview / document format preferences */
  includeDetails: boolean;        // organisational details (event date, category, context, people)
  includeClarifications: boolean;
  includeHistory: boolean;        // record history appendix
  order: 'asc' | 'desc';
  /* Scope filters — never change inclusion membership */
  from: string | null;
  to: string | null;
  category: string | null;
  person: string | null;
  /* Evidence */
  includeAttachments: boolean;
  includeVoice: boolean;
  attachmentTypes: AttachmentType[];   // empty = all types
}

export const DEFAULT_DOSSIER_TITLE = 'Chronological Record';

export const defaultDossierConfig: DossierConfig = {
  title: DEFAULT_DOSSIER_TITLE,
  includeDetails: true,
  includeClarifications: true,
  includeHistory: false,
  order: 'asc',
  from: null,
  to: null,
  category: null,
  person: null,
  includeAttachments: true,
  includeVoice: true,
  attachmentTypes: [],
};

/* ---------- Document model ---------- */

export interface DossierEvidenceItem {
  id: string;
  kind: 'voice' | 'attachment';
  type: AttachmentType;
  role: 'original' | 'later' | 'legacy_unresolved';
  name: string;
  mime: string;
  typeLabel: string;
  sizeLabel: string;
  durationLabel: string | null;
  description: string | null;
  addedLabel: string;
  roleLabel: string;
}

export interface DossierRecord {
  id: string;
  index: number;              // 1-based position in the document
  heading: string;
  contentsLabel: string;
  title: string | null;
  dateLabel: string;
  sealedLabel: string;
  capturedLabel: string;
  details: Array<{ label: string; value: string }>;
  text: string;
  clarifications: Array<{ id: string; label: string; text: string }>;
  history: string[];
  evidence: DossierEvidenceItem[];
}

export interface DossierDocumentModel {
  title: string;
  generatedAt: Date;
  generatedLabel: string;
  records: DossierRecord[];
  totalMembers: number;       // included records (ignores scope filters)
  hiddenByFilters: number;
  rangeLabel: string;
  people: string[];
  categories: string[];
  contents: Array<{ label: string; kind: 'section' | 'record' }>;
  integrity: string[];
  hasClarifications: boolean;
  hasEvidence: boolean;
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const compactContentsText = (value: string, max = 56): string => {
  const compacted = value.trim().replace(/\s+/g, ' ');
  return compacted.length > max ? `${compacted.slice(0, max - 1).trimEnd()}…` : compacted;
};

/** The event date exactly as recorded. A seal timestamp is never substituted. */
export const recordDate = (r: DossierSourceRecord): string | null => r.event_date;

/** Month used only to place records whose event date is unknown. */
export const recordPlacementMonth = (r: DossierSourceRecord): string =>
  (r.event_date ?? r.sealed_at.slice(0, 10)).slice(0, 7);

const compareStable = (a: DossierSourceRecord, b: DossierSourceRecord, order: 'asc' | 'desc'): number => {
  const direction = order === 'asc' ? 1 : -1;
  const month = recordPlacementMonth(a).localeCompare(recordPlacementMonth(b));
  if (month) return month * direction;

  const aKnown = a.event_date !== null;
  const bKnown = b.event_date !== null;
  // Unknown dates always follow dated records inside their placement month.
  if (aKnown !== bKnown) return aKnown ? -1 : 1;

  if (aKnown && bKnown) {
    const date = a.event_date!.localeCompare(b.event_date!);
    if (date) return date * direction;
    // A recorded time is used only when both records actually have one.
    if (a.event_time !== null && b.event_time !== null) {
      const time = a.event_time.localeCompare(b.event_time);
      if (time) return time * direction;
    }
  }

  const seal = a.sealed_at.localeCompare(b.sealed_at);
  if (seal) return seal * direction;
  return a.id.localeCompare(b.id) * direction;
};

export const compareDossierRecords = (
  a: DossierSourceRecord,
  b: DossierSourceRecord,
  order: 'asc' | 'desc' = 'asc',
): number => compareStable(a, b, order);

export const matchesScope = (r: DossierSourceRecord, c: DossierConfig): boolean => {
  if (c.category && r.category !== c.category) return false;
  if (c.person && !r.people.includes(c.person)) return false;
  // Date-range filters are event-date filters. Unknown event dates cannot be
  // asserted to fall inside a requested event-date range.
  if ((c.from || c.to) && !r.event_date) return false;
  if (c.from && r.event_date! < c.from) return false;
  if (c.to && r.event_date! > c.to) return false;
  return true;
};

export const evidenceForRecord = (
  media: DossierSourceMedia[],
  entryId: string,
  cfg: DossierConfig,
): DossierEvidenceItem[] =>
  media
    .filter(m => m.entry_id === entryId)
    .filter(m => !m.excluded_from_dossier)
    .filter(m => (m.kind === 'voice' ? cfg.includeVoice : cfg.includeAttachments))
    .filter(m => {
      if (m.kind === 'voice' || cfg.attachmentTypes.length === 0) return true;
      return cfg.attachmentTypes.includes(attachmentType(m.mime, m.name));
    })
    .sort((a, b) => {
      const roleRank = (role: DossierSourceMedia['role']) => role === 'original' ? 0 : role === 'later' ? 1 : 2;
      const rank = roleRank(a.role) - roleRank(b.role);
      if (rank) return rank;
      if (a.kind !== b.kind) return a.kind === 'voice' ? -1 : 1;
      const added = a.added_at.localeCompare(b.added_at);
      return added || a.id.localeCompare(b.id);
    })
    .map(m => {
      const t: AttachmentType = m.kind === 'voice' ? 'audio' : attachmentType(m.mime, m.name);
      return {
        id: m.id,
        kind: m.kind,
        type: t,
        role: m.role,
        name: m.name,
        mime: m.mime,
        typeLabel: m.kind === 'voice' ? 'Voice record' : typeLabel[t],
        sizeLabel: formatBytes(m.size),
        durationLabel: m.duration_ms ? formatDuration(m.duration_ms) : null,
        description: m.description,
        addedLabel: fmtDateTime(m.added_at),
        roleLabel: m.role === 'original'
          ? 'Present when the record was sealed'
          : m.role === 'later'
            ? 'Added after sealing'
            : 'When this file joined the record was not recorded',
      };
    });

export function buildDossierFromSource(
  all: DossierSourceRecord[],
  cfg: DossierConfig,
  media: DossierSourceMedia[] = [],
  now: Date = new Date(),
): DossierDocumentModel {
  const members = all.filter(e => e.in_dossier);
  const scoped = members
    .filter(e => matchesScope(e, cfg))
    .sort((a, b) => compareDossierRecords(a, b, cfg.order));

  const records: DossierRecord[] = scoped.map((e, i) => {
    const dateLabel = e.event_date ? fmtDate(e.event_date) : 'Date not recorded';
    const heading = `Record ${i + 1} — ${dateLabel}`;
    const fallbackTitle = e.original_text.split(/\r?\n/).find(line => line.trim()) ?? '';
    const subject = compactContentsText(e.title?.trim() || fallbackTitle);
    const contentsLabel = [heading, e.category, subject].filter(Boolean).join(' · ');
    const details: Array<{ label: string; value: string }> = [];
    if (e.event_date) details.push({ label: 'Date of event', value: fmtDate(e.event_date) + (e.event_time ? `, ${e.event_time}` : '') });
    if (e.category) details.push({ label: 'Category', value: e.category });
    if (e.context) details.push({ label: 'Context', value: e.context });
    if (e.people.length) details.push({ label: 'People', value: e.people.join(', ') });

    const history = [
      `Writing started ${fmtDateTime(e.captured_at)}`,
      `Record sealed ${fmtDateTime(e.sealed_at)}`,
      ...[...e.clarifications]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map((c, ci) => `Clarification ${ci + 1} added ${fmtDateTime(c.created_at)}`),
    ];

    return {
      id: e.id,
      index: i + 1,
      heading,
      contentsLabel,
      title: e.title,
      dateLabel,
      sealedLabel: fmtDateTime(e.sealed_at),
      capturedLabel: fmtDateTime(e.captured_at),
      details,
      text: e.original_text,
      clarifications: [...e.clarifications]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map((c, ci) => ({
          id: c.id,
          label: `Clarification ${ci + 1} · added ${fmtDateTime(c.created_at)}`,
          text: c.text,
        })),
      history,
      evidence: evidenceForRecord(media, e.id, cfg),
    };
  });

  const dates = scoped.map(recordDate).filter((date): date is string => date !== null).sort();
  const unknownCount = scoped.length - dates.length;
  const rangeLabel = dates.length === 0
    ? (unknownCount ? 'Event dates not recorded' : 'No records in range')
    : dates.length === 1 || dates[0] === dates[dates.length - 1]
      ? fmtDate(dates[0])
      : `${fmtDate(dates[0])} to ${fmtDate(dates[dates.length - 1])}`;

  const people = Array.from(new Set(scoped.flatMap(e => e.people))).sort();
  const categories = Array.from(new Set(scoped.map(e => e.category).filter(Boolean) as string[])).sort();
  const hasClarifications = scoped.some(e => e.clarifications.length > 0);
  const hasEvidence = records.some(r => r.evidence.length > 0);

  const contents: DossierDocumentModel['contents'] = [
    { label: 'Overview', kind: 'section' },
    { label: 'Chronological record', kind: 'section' },
    ...records.map(r => ({ label: r.contentsLabel, kind: 'record' as const })),
  ];
  if (cfg.includeClarifications && hasClarifications) {
    contents.push({ label: 'Appendix A — Clarifications', kind: 'section' });
  }
  if (cfg.includeHistory && records.length > 0) {
    contents.push({ label: 'Appendix B — Record history', kind: 'section' });
  }
  contents.push({ label: 'How this document was assembled', kind: 'section' });

  const integrity = [
    'The wording of each record is reproduced exactly as it was written and sealed. Nothing has been rewritten, corrected or summarised.',
    'Clarifications are additions made after a record was sealed. They are shown separately, with the date they were added, and never merged into the original wording.',
    'Organisational details such as category, context and people are labels added by the author for organisation. They are kept apart from the original wording.',
    'Records are ordered primarily by the date or time attributed to the event. Where multiple records share the same event date, their sealing time determines their order unless both have a recorded event time. Records for which no event date was recorded appear after dated records within the month in which they were sealed. A sealing date is not treated as an event date.',
    ...(hasEvidence
      ? [
        'Voice records and attachments are listed with the record they belong to, showing when each file was added where that information was recorded. Legacy files with no reliable provenance remain identified as not recorded rather than being treated as original.',
        'Chronicle has not analysed, transcribed or independently verified the contents of any attached file.',
      ]
      : []),
    `This document was generated on ${fmtDateTime(now.toISOString())} and contains ${records.length} record${records.length === 1 ? '' : 's'}.`,
    'This document is a personal record. It is not a certified or legally verified document.',
  ];

  return {
    title: cfg.title.trim() || DEFAULT_DOSSIER_TITLE,
    generatedAt: now,
    generatedLabel: fmtDateTime(now.toISOString()),
    records,
    totalMembers: members.length,
    hiddenByFilters: members.length - scoped.length,
    rangeLabel,
    people,
    categories,
    contents,
    integrity,
    hasClarifications,
    hasEvidence,
  };
}

export const safeFileName = (title: string) =>
  (title.trim() || DEFAULT_DOSSIER_TITLE)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'dossier';
