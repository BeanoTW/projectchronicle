/**
 * IncidentRecordCard — Unified rendering for all surfaces
 *
 * Section order (spec-locked):
 *   1. Header (ID + date/time)
 *   2. Meta (recorded_at, retrospective label)
 *   3. People involved
 *   4. Classification
 *   5. Raw narrative (primary)
 *   6. Exact words
 *   7. Follow-ups
 *   8. Evidence
 *   9. Integrity block
 *  10. Citation block
 */

import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import CategoryBadge from './CategoryBadge';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';

interface IncidentRecordCardProps {
  incident: Incident;
  followUps?: FollowUpNote[];
  evidence?: EvidenceFile[];
  compact?: boolean;
  onClick?: () => void;
}

function fmtFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy, HH:mm');
  } catch {
    return dateStr;
  }
}

function fmtDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

function retroLabel(incidentDate: string, createdAt: string): string | null {
  try {
    const gap = differenceInCalendarDays(parseISO(createdAt), parseISO(incidentDate));
    if (gap > 0) return `Recorded ${gap} day${gap === 1 ? '' : 's'} after event`;
    return null;
  } catch {
    return null;
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
  const retro = retroLabel(incident.incident_date, incident.created_at);

  if (compact) {
    return (
      <div
        className={`py-2.5 ${isVoided ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
        data-incident-id={incident.id}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">
            {fmtDate(incident.incident_date)}
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
                Follow-up ({fmtFull(fu.created_at)}): {fu.note_text}
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
      {/* 1. HEADER */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] text-muted-foreground font-medium">
            {incident.id.slice(0, 8).toUpperCase()}
          </p>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-foreground">{fmtDate(incident.incident_date)}</p>
            {incident.incident_time && (
              <p className="text-[12px] text-muted-foreground">{incident.incident_time}</p>
            )}
          </div>
        </div>
        {isVoided && (
          <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mt-1 inline-block">Voided</span>
        )}
      </div>

      {/* 2. META — recorded_at + retrospective */}
      <div className="px-4 py-2.5 border-b border-border/50 text-[12px] text-muted-foreground space-y-0.5">
        <p>Recorded: {fmtFull(incident.created_at)}</p>
        {retro && <p className="text-muted-foreground/70">{retro}</p>}
        {incident.location && <p>{incident.location}</p>}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* 3. PEOPLE INVOLVED */}
        {incident.people_involved.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">People involved</p>
            <p className="text-[13px] text-foreground">{incident.people_involved.join(', ')}</p>
          </div>
        )}

        {/* 4. CLASSIFICATION */}
        {incident.category && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Classification</p>
            <CategoryBadge category={incident.category} subtype={incident.subtype ?? undefined} />
          </div>
        )}

        {/* 5. RAW NARRATIVE (primary) */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">User-provided account</p>
          <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
            {incident.raw_narrative}
          </p>
        </div>

        {/* 6. EXACT WORDS */}
        {incident.exact_words && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Exact words</p>
            <div className="border-l-[3px] border-muted-foreground/20 pl-3">
              <p className="text-[13px] text-foreground italic leading-relaxed">"{incident.exact_words}"</p>
            </div>
          </div>
        )}

        {/* 7. FOLLOW-UPS */}
        {followUps.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Follow-ups</p>
            <div className="space-y-1.5">
              {followUps.map(fu => (
                <div key={fu.id} className="text-[12px] text-muted-foreground" data-followup-id={fu.id}>
                  <span className="text-muted-foreground/60">Follow-up — {fmtFull(fu.created_at)}</span>
                  <p className="mt-0.5">{fu.note_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. EVIDENCE */}
        {evidence.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Evidence</p>
            <div className="space-y-1">
              {evidence.map(ev => (
                <div key={ev.id} className="text-[12px] text-muted-foreground">
                  E{String(ev.evidence_ref_number || '?').padStart(2, '0')} — {ev.file_name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. INTEGRITY BLOCK */}
        <div className="pt-2 border-t border-border/50 space-y-0.5">
          <p className="text-[10px] text-muted-foreground/60">
            This record was created on {fmtFull(incident.created_at)}
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Original content preserved · Updates appended without overwriting
          </p>
          {incident.category_source === 'user' && (
            <p className="text-[10px] text-muted-foreground/60">Classification reviewed before save</p>
          )}
        </div>

        {/* 10. CITATION BLOCK */}
        <div className="pt-2 border-t border-border/50 font-mono text-[10px] text-muted-foreground/50 space-y-0.5">
          <p>Incident ID: {incident.id}</p>
          <p>Incident date: {fmtDate(incident.incident_date)}</p>
          <p>Recorded: {fmtFull(incident.created_at)}</p>
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

function fmtFullHtml(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd MMMM yyyy, HH:mm'); } catch { return dateStr; }
}

function fmtDateHtml(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd MMMM yyyy'); } catch { return dateStr; }
}

function retroLabelHtml(incidentDate: string, createdAt: string): string | null {
  try {
    const gap = differenceInCalendarDays(parseISO(createdAt), parseISO(incidentDate));
    if (gap > 0) return `Recorded ${gap} day${gap === 1 ? '' : 's'} after event`;
    return null;
  } catch { return null; }
}

export function renderIncidentCardHtml(data: IncidentCardHtmlData): string {
  const { incident, followUps, evidence } = data;
  const retro = retroLabelHtml(incident.incident_date, incident.created_at);
  let html = `<div class="incident-card" style="page-break-inside:avoid" data-incident-id="${esc(incident.id)}">`;

  // 1. HEADER
  html += `<div class="header"><span class="incident-id">${esc(incident.id.slice(0, 8).toUpperCase())}</span>`;
  html += `<span class="incident-date">${fmtDateHtml(incident.incident_date)}`;
  if (incident.incident_time) html += ` · ${esc(incident.incident_time)}`;
  html += `</span></div>`;

  // 2. META
  html += `<div class="meta"><p>Recorded: ${fmtFullHtml(incident.created_at)}</p>`;
  if (retro) html += `<p>${esc(retro)}</p>`;
  if (incident.location) html += `<p>${esc(incident.location)}</p>`;
  html += `</div>`;

  // 3. PEOPLE
  if (incident.people_involved.length > 0) {
    html += `<div class="section people"><p class="section-label">People involved</p>`;
    html += `<p>${incident.people_involved.map(p => esc(p)).join(', ')}</p></div>`;
  }

  // 4. CLASSIFICATION
  if (incident.category) {
    const displayCat = esc(incident.category);
    const sub = incident.subtype && incident.subtype !== 'Unclassified' && incident.subtype !== 'Other' && incident.subtype !== incident.category
      ? ` → ${esc(incident.subtype)}` : '';
    html += `<div class="section classification"><p class="section-label">Classification</p>`;
    html += `<p>${displayCat}${sub}</p></div>`;
  }

  // 5. NARRATIVE
  html += `<div class="section narrative"><p class="section-label">User-provided account</p>`;
  html += `<p class="narrative-text">${esc(incident.raw_narrative)}</p></div>`;

  // 6. EXACT WORDS
  if (incident.exact_words) {
    html += `<div class="section exact-words"><p class="section-label">Exact words</p>`;
    html += `<blockquote>"${esc(incident.exact_words)}"</blockquote></div>`;
  }

  // 7. FOLLOW-UPS
  if (followUps.length > 0) {
    html += `<div class="section followups"><p class="section-label">Follow-ups</p>`;
    followUps.forEach(fu => {
      html += `<div class="followup-entry" data-followup-id="${esc(fu.id)}">`;
      html += `<span class="followup-date">Follow-up — ${fmtFullHtml(fu.created_at)}</span>`;
      html += `<p>${esc(fu.note_text)}</p></div>`;
    });
    html += `</div>`;
  }

  // 8. EVIDENCE
  if (evidence.length > 0) {
    html += `<div class="section evidence"><p class="section-label">Evidence</p>`;
    evidence.forEach(ev => {
      html += `<div class="evidence-entry">E${String(ev.evidence_ref_number || '?').padStart(2, '0')} — ${esc(ev.file_name)}</div>`;
    });
    html += `</div>`;
  }

  // 9. INTEGRITY
  html += `<div class="section integrity">`;
  html += `<p>This record was created on ${fmtFullHtml(incident.created_at)}</p>`;
  html += `<p>Original content preserved · Updates appended without overwriting</p>`;
  if (incident.category_source === 'user') html += `<p>Classification reviewed before save</p>`;
  html += `</div>`;

  // 10. CITATION
  html += `<div class="section citation">`;
  html += `<p>Incident ID: ${esc(incident.id)}</p>`;
  html += `<p>Incident date: ${fmtDateHtml(incident.incident_date)}</p>`;
  html += `<p>Recorded: ${fmtFullHtml(incident.created_at)}</p>`;
  html += `</div>`;

  html += `</div>`;
  return html;
}
