/**
 * IncidentRecordCard — Unified rendering for all surfaces
 *
 * Structurally identical across: timeline view, sequence view, export HTML.
 * Sequences MUST NOT change how incidents are rendered.
 */

import { format, parseISO } from 'date-fns';
import CategoryBadge from './CategoryBadge';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';

interface IncidentRecordCardProps {
  incident: Incident;
  followUps?: FollowUpNote[];
  evidence?: EvidenceFile[];
  /** If true, renders as a compact summary line (export/sequence view) */
  compact?: boolean;
  onClick?: () => void;
}

function formatTimestamp(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy, HH:mm');
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

const IncidentRecordCard = ({
  incident,
  followUps = [],
  evidence = [],
  compact = false,
  onClick,
}: IncidentRecordCardProps) => {
  const isVoided = !!incident.voided_at;

  if (compact) {
    return (
      <div
        className={`py-2.5 ${isVoided ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
        data-incident-id={incident.id}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">
            {formatDateOnly(incident.incident_date)}
          </span>
          {incident.incident_time && (
            <span className="text-[12px] text-muted-foreground">{incident.incident_time}</span>
          )}
          <span className="text-[12px] text-muted-foreground">—</span>
          <span className="text-[13px] text-foreground line-clamp-1">
            {incident.title || incident.ai_summary || incident.raw_narrative?.slice(0, 80) || 'Untitled incident'}
          </span>
        </div>
        {followUps.length > 0 && (
          <div className="ml-4 mt-1 space-y-0.5">
            {followUps.map(fu => (
              <p key={fu.id} className="text-[11px] text-muted-foreground/70">
                Follow-up ({formatTimestamp(fu.created_at)}): {fu.note_text}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-card border border-border rounded-xl overflow-hidden ${isVoided ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer hover:shadow-[var(--shadow-card-hover)] transition-shadow' : ''}`}
      onClick={onClick}
      data-incident-id={incident.id}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        {incident.category && (
          <div className="mb-1">
            <CategoryBadge category={incident.category} subtype={incident.subtype ?? undefined} />
          </div>
        )}
        <h3 className={`text-[15px] font-semibold leading-snug ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {isVoided && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mr-1.5 no-underline inline-block">Voided</span>}
          {incident.title || 'Untitled incident'}
        </h3>
      </div>

      {/* Meta */}
      <div className="px-4 py-2.5 border-b border-border/50 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>{formatDateOnly(incident.incident_date)}</span>
        {incident.incident_time && <><span className="opacity-30">·</span><span>{incident.incident_time}</span></>}
        {incident.location && <><span className="opacity-30">·</span><span>{incident.location}</span></>}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* People */}
        {incident.people_involved.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">People involved</p>
            <div className="flex flex-wrap gap-1">
              {incident.people_involved.map(p => (
                <span key={p} className="bg-primary/6 text-primary px-2 py-0.5 rounded text-[11px] font-medium border border-primary/12">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Classification */}
        {incident.category && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Classification</p>
            <CategoryBadge category={incident.category} subtype={incident.subtype ?? undefined} />
          </div>
        )}

        {/* Narrative */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Narrative</p>
          <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
            {incident.raw_narrative}
          </p>
        </div>

        {/* Exact words */}
        {incident.exact_words && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Exact words recorded</p>
            <div className="border-l-[3px] border-muted-foreground/20 pl-3">
              <p className="text-[13px] text-foreground italic leading-relaxed">"{incident.exact_words}"</p>
            </div>
          </div>
        )}

        {/* Follow-ups */}
        {followUps.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Follow-ups ({followUps.length})</p>
            <div className="space-y-1.5">
              {followUps.map(fu => (
                <div key={fu.id} className="text-[12px] text-muted-foreground" data-followup-id={fu.id}>
                  <span className="text-muted-foreground/60">{formatTimestamp(fu.created_at)}</span>
                  <span className="mx-1">—</span>
                  <span>{fu.note_text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence */}
        {evidence.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Attachments ({evidence.length})</p>
            <div className="space-y-1">
              {evidence.map(ev => (
                <div key={ev.id} className="text-[12px] text-muted-foreground">
                  E{String(ev.evidence_ref_number || '?').padStart(2, '0')} — {ev.file_name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrity line */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/50">
            Recorded on {formatTimestamp(incident.created_at).replace(', ', ' at ')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IncidentRecordCard;

// ─── HTML Renderer (for export) ──────────────────────────────

export interface IncidentCardHtmlData {
  incident: Incident;
  followUps: Array<{ id: string; created_at: string; note_text: string }>;
  evidence: Array<{ id: string; file_name: string; evidence_ref_number?: number | null }>;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateHtml(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

function formatTimestampHtml(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy, HH:mm');
  } catch {
    return dateStr;
  }
}

export function renderIncidentCardHtml(data: IncidentCardHtmlData): string {
  const { incident, followUps, evidence } = data;
  let html = `<div class="incident-card" data-incident-id="${esc(incident.id)}">`;

  // Header
  html += `<div class="card-header"><h3>${esc(incident.title || 'Untitled incident')}</h3></div>`;

  // Meta
  html += `<div class="card-meta">`;
  html += `<span>${formatDateHtml(incident.incident_date)}</span>`;
  if (incident.incident_time) html += ` · <span>${esc(incident.incident_time)}</span>`;
  if (incident.location) html += ` · <span>${esc(incident.location)}</span>`;
  html += `</div>`;

  // People
  if (incident.people_involved.length > 0) {
    html += `<div class="card-section"><p class="section-label">People involved</p>`;
    html += incident.people_involved.map(p => `<span class="person-tag">${esc(p)}</span>`).join(' ');
    html += `</div>`;
  }

  // Classification
  if (incident.category) {
    html += `<div class="card-section"><p class="section-label">Classification</p>`;
    html += `<span class="category-tag">${esc(incident.category)}${incident.subtype ? ` — ${esc(incident.subtype)}` : ''}</span>`;
    html += `</div>`;
  }

  // Narrative
  html += `<div class="card-section"><p class="section-label">Narrative</p>`;
  html += `<p class="narrative">${esc(incident.raw_narrative)}</p>`;
  html += `</div>`;

  // Exact words
  if (incident.exact_words) {
    html += `<div class="card-section"><p class="section-label">Exact words recorded</p>`;
    html += `<blockquote class="exact-words">"${esc(incident.exact_words)}"</blockquote>`;
    html += `</div>`;
  }

  // Follow-ups
  if (followUps.length > 0) {
    html += `<div class="card-section"><p class="section-label">Follow-ups (${followUps.length})</p>`;
    followUps.forEach(fu => {
      html += `<div class="followup-entry" data-followup-id="${esc(fu.id)}">`;
      html += `<span class="followup-date">${formatTimestampHtml(fu.created_at)}</span> — ${esc(fu.note_text)}`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // Evidence
  if (evidence.length > 0) {
    html += `<div class="card-section"><p class="section-label">Attachments (${evidence.length})</p>`;
    evidence.forEach(ev => {
      html += `<div class="evidence-entry">E${String(ev.evidence_ref_number || '?').padStart(2, '0')} — ${esc(ev.file_name)}</div>`;
    });
    html += `</div>`;
  }

  // Integrity
  html += `<div class="card-citation"><p>Recorded ${formatTimestampHtml(incident.created_at)}</p></div>`;

  html += `</div>`;
  return html;
}
