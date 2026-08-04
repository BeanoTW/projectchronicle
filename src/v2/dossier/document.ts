// Prototype-only. Builds the single document model used by the on-screen preview,
// the PDF export and the DOCX export, so all three stay identical.
import type { V2Entry, V2Media } from '../db';
import { entryDate } from '../filters';
import { attachmentType, formatBytes, formatDuration, typeLabel, type AttachmentType } from '../media/media';

export interface DossierConfig {
  title: string;
  /* Preview / document format preferences */
  includeDetails: boolean;        // organisational details (event date, category, context, people)
  includeClarifications: boolean;
  includeHistory: boolean;        // record history appendix
  order: 'asc' | 'desc';
  /* Scope filters — never change `in_dossier` membership */
  from: string | null;
  to: string | null;
  category: string | null;
  person: string | null;
  /* Evidence */
  includeAttachments: boolean;
  includeVoice: boolean;
  attachmentTypes: AttachmentType[];   // empty = all types
}

export const DEFAULT_DOSSIER_TITLE = 'Chronological record';

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

export interface DossierEvidenceItem {
  id: string;
  kind: 'voice' | 'attachment';
  type: AttachmentType;
  role: 'original' | 'later';
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
  heading: string;            // "Record 1 — 14 March 2025"
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
  totalMembers: number;       // records with in_dossier = true (ignores filters)
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
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const matchesScope = (e: V2Entry, c: DossierConfig): boolean => {
  if (c.category && e.category !== c.category) return false;
  if (c.person && !e.people.includes(c.person)) return false;
  const d = entryDate(e);
  if (c.from && d < c.from) return false;
  if (c.to && d > c.to) return false;
  return true;
};

export const evidenceForRecord = (
  media: V2Media[],
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
      if (a.role !== b.role) return a.role === 'original' ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === 'voice' ? -1 : 1;
      return a.added_at.localeCompare(b.added_at);
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
        roleLabel: m.role === 'original' ? 'Present when the record was sealed' : 'Added after sealing',
      };
    });

export function buildDossierDocument(
  all: V2Entry[],
  cfg: DossierConfig,
  media: V2Media[] = [],
  now: Date = new Date(),
): DossierDocumentModel {
  const members = all.filter(e => e.in_dossier);
  const scoped = members
    .filter(e => matchesScope(e, cfg))
    .sort((a, b) =>
      cfg.order === 'asc'
        ? a.sealed_at.localeCompare(b.sealed_at)
        : b.sealed_at.localeCompare(a.sealed_at),
    );

  const records: DossierRecord[] = scoped.map((e, i) => {
    const dateLabel = fmtDate(entryDate(e));
    const details: Array<{ label: string; value: string }> = [];
    if (e.event_date) details.push({ label: 'Date of event', value: fmtDate(e.event_date) + (e.event_time ? `, ${e.event_time}` : '') });
    if (e.category) details.push({ label: 'Category', value: e.category });
    if (e.context) details.push({ label: 'Context', value: e.context });
    if (e.people.length) details.push({ label: 'People', value: e.people.join(', ') });

    const history = [
      `Writing started ${fmtDateTime(e.captured_at)}`,
      `Record sealed ${fmtDateTime(e.sealed_at)}`,
      ...[...e.clarifications]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c, ci) => `Clarification ${ci + 1} added ${fmtDateTime(c.created_at)}`),
    ];

    return {
      id: e.id,
      index: i + 1,
      heading: `Record ${i + 1} — ${dateLabel}`,
      title: e.title,
      dateLabel,
      sealedLabel: fmtDateTime(e.sealed_at),
      capturedLabel: fmtDateTime(e.captured_at),
      details,
      text: e.original_text,
      clarifications: [...e.clarifications]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c, ci) => ({
          id: c.id,
          label: `Clarification ${ci + 1} · added ${fmtDateTime(c.created_at)}`,
          text: c.text,
        })),
      history,
      evidence: evidenceForRecord(media, e.id, cfg),
    };
  });

  const dates = scoped.map(entryDate).sort();
  const rangeLabel = dates.length === 0
    ? 'No records in range'
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
    ...records.map(r => ({ label: r.heading, kind: 'record' as const })),
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
    'Records appear in chronological order by the date each one was sealed.',
    ...(hasEvidence
      ? [
        'Voice records and attachments are listed with the record they belong to, showing when each file was added. Files present when a record was sealed are distinguished from files added afterwards.',
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
