/**
 * Tribunal HTML Renderer — Pure projection layer
 *
 * Takes a fully prepared TribunalExportPayload from the V3 TRIBUNAL pipeline
 * and renders a deterministic HTML document. No derivation, no interpretation.
 */

import { format } from 'date-fns';

// ─── Types (renderer input contract) ─────────────────────────

export interface TribunalIncidentRef {
  incident_id: string;
  incident_date: string;
  incident_time?: string;
  short_structured_summary: string;
  follow_ups: TribunalFollowUp[];
}

export interface TribunalFollowUp {
  follow_up_id: string;
  created_at: string;
  note_text: string;
}

export interface TribunalIssue {
  issue_title: string;
  core_incidents: TribunalIncidentRef[];
  supporting_incidents: TribunalIncidentRef[];
  sequence: string;
  observed_features: string[];
  comparator_contrast: string[];
  display_order: number;
}

export interface TribunalExportPayload {
  overview_text: string;
  issues: TribunalIssue[];
  cross_issue_observations: string[];
  structural_statement: string;
  integrity_statement: string;
  export_scope_metadata: {
    total_incidents: number;
    selected_incidents: number;
    date_range_start: string;
    date_range_end: string;
  };
}

// ─── HTML helpers ────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, 'd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

// ─── Renderer ────────────────────────────────────────────────

export function renderTribunalHtml(payload: TribunalExportPayload): string {
  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 780px; margin: 0 auto; padding: 40px 24px 60px; color: #1A2332; line-height: 1.65; font-size: 14px; }
    h1 { font-size: 22px; font-weight: 700; border-bottom: 2px solid #1A2332; padding-bottom: 8px; margin-bottom: 6px; }
    h2 { font-size: 17px; font-weight: 700; color: #1A2332; margin-top: 32px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #D1D5DB; }
    h3 { font-size: 14px; font-weight: 600; color: #374151; margin-top: 16px; margin-bottom: 4px; }
    p { margin-bottom: 8px; }
    .meta { color: #6B7280; font-size: 12px; }
    .overview { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; margin: 16px 0 24px; font-size: 14px; line-height: 1.7; }
    .issue-block { margin-bottom: 28px; }
    .incident-line { padding: 6px 0; font-size: 13px; line-height: 1.5; }
    .incident-line .date { font-weight: 600; color: #374151; }
    .follow-up { padding-left: 20px; font-size: 12px; color: #6B7280; margin: 2px 0; }
    .section-label { font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 12px; margin-bottom: 4px; }
    .feature-list { padding-left: 18px; margin: 4px 0 8px; }
    .feature-list li { font-size: 13px; margin-bottom: 3px; }
    .cross-issues { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; margin: 8px 0; }
    .cross-issues li { font-size: 13px; margin-bottom: 4px; }
    .structural { margin-top: 28px; font-size: 13px; color: #374151; padding: 12px 16px; background: #F3F4F6; border-radius: 6px; }
    .integrity { margin-top: 20px; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 16px; }
    .footer { margin-top: 24px; font-size: 11px; color: #9CA3AF; }
    .limited-note { font-size: 12px; color: #9CA3AF; font-style: italic; margin: 4px 0; }
    @media print { body { padding: 20px; } .issue-block { page-break-inside: avoid; } }
  `;

  const now = new Date();
  const exportDate = format(now, 'd MMMM yyyy');
  const exportTime = format(now, 'HH:mm');

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Chronicle Structured Record</title><style>${css}</style></head><body>`;

  // 1. Title
  html += `<h1>Chronicle Structured Record</h1>`;
  html += `<p class="meta">${esc(payload.export_scope_metadata.selected_incidents.toString())} incident${payload.export_scope_metadata.selected_incidents !== 1 ? 's' : ''} · ${formatDateDisplay(payload.export_scope_metadata.date_range_start)} – ${formatDateDisplay(payload.export_scope_metadata.date_range_end)}</p>`;

  // 2. Overview
  if (payload.overview_text) {
    html += `<div class="overview">${esc(payload.overview_text)}</div>`;
  }

  // 3. Issues
  if (payload.issues.length > 0) {
    html += `<h2>Issues Identified</h2>`;

    for (const issue of payload.issues) {
      html += `<div class="issue-block">`;
      html += `<h3>${esc(issue.issue_title)}</h3>`;

      // Core incidents
      if (issue.core_incidents.length > 0) {
        html += `<p class="section-label">Core incidents</p>`;
        for (const inc of issue.core_incidents) {
          html += renderIncidentLine(inc);
        }
      }

      // Supporting incidents
      if (issue.supporting_incidents.length > 0) {
        html += `<p class="section-label">Supporting incidents</p>`;
        for (const inc of issue.supporting_incidents) {
          html += renderIncidentLine(inc);
        }
        if (issue.supporting_incidents.length < 2) {
          html += `<p class="limited-note">Limited supporting records available</p>`;
        }
      } else if (issue.core_incidents.length < 2) {
        html += `<p class="limited-note">Limited supporting records available</p>`;
      }

      // Sequence
      if (issue.sequence) {
        html += `<p class="section-label">Sequence</p>`;
        html += `<p style="font-size:13px">${esc(issue.sequence)}</p>`;
      }

      // Observed features
      if (issue.observed_features.length > 0) {
        html += `<p class="section-label">Observed features</p>`;
        html += `<ul class="feature-list">`;
        for (const f of issue.observed_features) {
          html += `<li>${esc(f)}</li>`;
        }
        html += `</ul>`;
      }

      // Comparator / Contrast
      if (issue.comparator_contrast.length > 0) {
        html += `<p class="section-label">Comparator / Contrast</p>`;
        html += `<ul class="feature-list">`;
        for (const c of issue.comparator_contrast) {
          html += `<li>${esc(c)}</li>`;
        }
        html += `</ul>`;
      }

      html += `</div>`;
    }
  }

  // 4. Cross-issue observations
  if (payload.cross_issue_observations.length > 0) {
    html += `<h2>Cross-Issue Observations</h2>`;
    html += `<div class="cross-issues"><ul>`;
    for (const obs of payload.cross_issue_observations) {
      html += `<li>${esc(obs)}</li>`;
    }
    html += `</ul></div>`;
  }

  // 5. Structural statement
  if (payload.structural_statement) {
    html += `<div class="structural">${esc(payload.structural_statement)}</div>`;
  }

  // 6. Integrity statement
  html += `<div class="integrity">${esc(payload.integrity_statement)}</div>`;

  // Footer
  html += `<p class="footer">Export generated on: ${exportDate} ${exportTime}</p>`;

  html += `</body></html>`;
  return html;
}

function renderIncidentLine(inc: TribunalIncidentRef): string {
  let html = `<div class="incident-line" data-incident-id="${esc(inc.incident_id)}">`;
  html += `<span class="date">${formatDateDisplay(inc.incident_date)}</span>`;
  if (inc.incident_time) {
    html += ` <span class="meta">${esc(inc.incident_time)}</span>`;
  }
  html += ` — ${esc(inc.short_structured_summary)}`;
  html += `</div>`;

  // Follow-ups
  for (const fu of inc.follow_ups) {
    html += `<div class="follow-up" data-followup-id="${esc(fu.follow_up_id)}">`;
    html += `Follow-up (${formatDateDisplay(fu.created_at)}): ${esc(fu.note_text)}`;
    html += `</div>`;
  }

  return html;
}

// ─── Filename generator ──────────────────────────────────────

export function getTribunalFilename(): string {
  const now = new Date();
  const date = format(now, 'yyyy-MM-dd');
  const time = format(now, 'HHmm');
  return `chronicle-tribunal-${date}-${time}.html`;
}
