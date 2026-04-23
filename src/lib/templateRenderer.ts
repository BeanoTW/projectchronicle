/**
 * Template-compliant export renderer.
 *
 * Produces the locked Chronicle export structure:
 *   1. Cover
 *   2. Chronological Index
 *   3. Full Record
 *   4. Closing block
 *
 * No interpretation. No grouped-by-category sections. No sequence summaries.
 * Pure deterministic projection of incidents + follow-ups + evidence.
 */

import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';
import { APP_VERSION } from '@/lib/appVersion';

export interface TemplateRenderInput {
  incidents: Incident[]; // already filtered (active, included)
  followUps: FollowUpNote[];
  evidence: EvidenceFile[];
}

// ─── helpers ──────────────────────────────────────────────────

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeParse(d: string): Date | null {
  try {
    const v = parseISO(d);
    if (isNaN(v.getTime())) return null;
    return v;
  } catch {
    return null;
  }
}

function fmtDateShort(d: string): string {
  const v = safeParse(d);
  return v ? format(v, 'dd MMM yyyy') : d;
}

function fmtDateLong(d: string): string {
  const v = safeParse(d);
  return v ? format(v, 'd MMMM yyyy') : d;
}

function fmtRecorded(d: string): string {
  const v = safeParse(d);
  return v ? format(v, 'd MMM yyyy, HH:mm') : d;
}

function fmtMonthYear(d: string): string {
  const v = safeParse(d);
  return v ? format(v, 'MMMM yyyy') : '';
}

function categorySlug(cat?: string | null): string {
  if (!cat) return 'unclassified';
  const c = cat.toLowerCase();
  if (c.startsWith('comm')) return 'communication';
  if (c.startsWith('action')) return 'action';
  if (c.startsWith('process')) return 'process';
  if (c.startsWith('working')) return 'working';
  if (c.startsWith('pay')) return 'process';
  if (c.startsWith('observed')) return 'communication';
  if (c.startsWith('record')) return 'process';
  return 'unclassified';
}

/**
 * Compact category label for the index — abbreviation, NOT truncation.
 * Keeps the column tight without losing meaning.
 */
function indexCategoryLabel(cat: string): string {
  const c = (cat || '').trim();
  const lower = c.toLowerCase();
  if (lower === 'daily record' || lower === 'daily') return 'Daily';
  if (lower.startsWith('communication')) return 'Communication';
  if (lower.startsWith('working')) return 'Working Cond.';
  if (lower.startsWith('record issued') || lower.startsWith('record-issued')) return 'Record Issued';
  if (lower.startsWith('process')) return 'Process Event';
  if (lower.startsWith('pay')) return 'Pay / Benefits';
  if (lower.startsWith('observed')) return 'Obs. Behaviour';
  if (lower.startsWith('action')) return 'Action / Change';
  if (lower === 'not sure yet' || lower === 'unclassified' || lower === 'other') return 'Not Sure Yet';
  return c;
}

function cleanLine(s: string): string {
  // Strip field-label prefixes ("Date:", "Location:", etc.), collapse whitespace,
  // take the first line only.
  return String(s)
    .replace(/\r/g, '')
    .split('\n')[0]
    .replace(/^\s*(date|time|location|people|category|subtype)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildShortTitle(inc: Incident): string {
  // Deterministic single-line index title.
  // Priority: exact_words → title → first sentence of raw_narrative.
  if (inc.exact_words && inc.exact_words.trim().length > 0) {
    const t = cleanLine(inc.exact_words).replace(/^["“”]+|["“”]+$/g, '');
    if (t) return `"${t.length > 90 ? t.slice(0, 87) + '…' : t}"`;
  }
  if (inc.title && inc.title.trim().length > 0) {
    const t = cleanLine(inc.title);
    if (t) return t.length > 110 ? t.slice(0, 107) + '…' : t;
  }
  const narrative = cleanLine(inc.raw_narrative || '');
  if (!narrative) return '(no summary)';
  const firstSentence = narrative.split(/(?<=[.!?])\s+/)[0] || narrative;
  return firstSentence.length > 110 ? firstSentence.slice(0, 107) + '…' : firstSentence;
}

/**
 * Two-column index summary: target ~4–8 words / ≤52 chars, truncate ONLY at a
 * word boundary so the row remains scannable ("Manager remarked about
 * absences…" instead of "Manag…").
 */
function indexSummary(inc: Incident): string {
  const full = buildShortTitle(inc);
  const MAX = 52;
  if (full.length <= MAX) return full;
  // Cut at last whitespace before MAX.
  const slice = full.slice(0, MAX);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:.\-—]+$/, '') + '…';
}

function isDaily(inc: Incident): boolean {
  return (inc as any).record_type === 'daily_record';
}

/** Normalise category for display. "Other"/empty → "Not sure yet". */
function displayCategory(cat?: string | null): string {
  const v = (cat || '').trim();
  if (!v || v.toLowerCase() === 'other' || v.toLowerCase() === 'unclassified' || v.toLowerCase() === 'not classified') {
    return 'Not sure yet';
  }
  return v;
}

function classificationLine(inc: Incident): string {
  const parts: string[] = [];
  if (isDaily(inc)) {
    parts.push('Daily record');
  } else {
    const cat = displayCategory(inc.category);
    const subRaw = (inc.subtype || '').trim();
    const subOk = subRaw && !['Unclassified', 'Not sure yet', 'Other', 'null', 'undefined', inc.category || ''].includes(subRaw);
    parts.push(subOk ? `${cat} → ${subRaw}` : cat);
  }
  const loc = (inc.location || '').trim();
  if (loc && loc.toLowerCase() !== 'null' && loc.toLowerCase() !== 'undefined') {
    parts.push(loc);
  }
  return parts.join(' · ');
}


function exportIdFor(now: Date): string {
  return `CHR-${format(now, 'yyyy-MMdd-HHmm')}`;
}

// ─── CSS (locked template) ────────────────────────────────────

const CSS = `
:root {
  --ink: #171717;
  --ink-mid: #3A3A3C;
  --ink-light: #6C6C70;
  --ink-faint: #8A8A8E;
  --rule: #D1D1D6;
  --rule-light: #E5E5EA;
  --rule-soft: #ECECE7;
  --bg: #FAFAF8;
  --bg-tint: #F2F2F0;
  --bg-card: #FFFFFF;
  --accent: #2C5F2E;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Source Serif 4', Georgia, serif;
  background: var(--bg); color: var(--ink);
  font-size: 14px; line-height: 1.55;
  max-width: 920px; margin: 0 auto; padding: 0 0 80px;
}
.cover { padding: 56px 56px 36px; border-bottom: 2px solid var(--ink); position: relative; }
.cover-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin-bottom: 20px; }
.cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 24px; }
.cover-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid var(--rule); margin-top: 24px; }
.cover-meta-item { padding: 12px 0; border-bottom: 1px solid var(--rule-light); }
.cover-meta-item:nth-child(odd) { padding-right: 28px; border-right: 1px solid var(--rule-light); }
.cover-meta-item:nth-child(even) { padding-left: 28px; }
.meta-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 3px; }
.meta-value { font-size: 13px; font-weight: 600; color: var(--ink); }
.cover-statement { margin-top: 22px; padding: 14px 18px; background: var(--bg-tint); border-left: 3px solid var(--accent); font-size: 12px; color: var(--ink-mid); line-height: 1.6; font-style: italic; }
.section-header { padding: 18px 56px 10px; border-bottom: 1px solid var(--rule); margin-top: 36px; display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.section-header h2 { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 600; color: var(--ink); }
.section-count { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-faint); letter-spacing: 0.1em; text-transform: uppercase; }

/* INDEX (two-column, ledger style) */
.index-container { padding: 0 56px; margin-top: 8px; }
.index-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; margin-top: 14px; align-items: start; }
.index-col { min-width: 0; }
.index-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
.index-table colgroup .cg-date { width: 24%; }
.index-table colgroup .cg-time { width: 12%; }
.index-table colgroup .cg-cat  { width: 24%; }
.index-table colgroup .cg-sum  { width: 28%; }
.index-table colgroup .cg-id   { width: 12%; }
.index-table thead tr { border-bottom: 1px solid var(--rule); }
.index-table th { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; padding: 6px 6px 6px 0; text-align: left; }
.index-table th:last-child { padding-right: 0; text-align: right; }
.index-table tbody tr { border-bottom: 1px solid var(--rule-soft); }
.index-table td { padding: 6px 6px 6px 0; font-size: 11px; color: var(--ink-mid); vertical-align: top; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.index-table td:last-child { padding-right: 0; text-align: right; }
.index-date { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink); font-weight: 500; white-space: nowrap; }
.index-cat { font-size: 10.5px; color: var(--ink-mid); white-space: nowrap; overflow: hidden; text-overflow: clip; display: block; }
.index-title { font-size: 11px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.index-id { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--ink-faint); white-space: nowrap; }
.index-month-row td { padding-top: 12px; padding-bottom: 4px; white-space: normal; border-bottom: none; }
.index-month-label { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.index-month-cont { color: var(--ink-faint); font-style: italic; letter-spacing: 0.12em; margin-left: 6px; text-transform: none; }

/* FULL RECORD — flat document flow, NO cards */
.records-container { padding: 0 56px; margin-top: 4px; }
.month-divider {
  margin: 22px 0 8px;
  padding-top: 8px;
  border-top: 1px solid var(--rule);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 600;
}
.month-divider:first-child { border-top: none; padding-top: 0; margin-top: 8px; }

.record {
  border-bottom: 1px solid var(--rule-soft);
  padding: 10px 0 12px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.record-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 3px;
}
.record-head .left {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.005em;
}
.record-head .right {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: var(--ink-light);
  text-align: right;
  white-space: nowrap;
}
.record-meta {
  font-size: 11.5px;
  color: var(--ink-light);
  margin-bottom: 4px;
}
.record-people {
  font-size: 12px;
  color: var(--ink-mid);
  margin-bottom: 4px;
}
.record-people .label {
  color: var(--ink-faint);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin-right: 4px;
}
.record-narrative {
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink);
  margin: 4px 0 6px;
  white-space: pre-wrap;
}
.record-extra {
  font-size: 12px;
  color: var(--ink-mid);
  margin: 4px 0;
}
.record-extra .label {
  color: var(--ink-faint);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin-right: 4px;
}
.exact-words-inline {
  font-style: italic;
  color: var(--ink-mid);
}
.followup-inline {
  display: block;
  padding-left: 10px;
  border-left: 2px solid var(--rule-light);
  margin-top: 3px;
  font-size: 12px;
  color: var(--ink-mid);
}
.followup-inline .followup-date {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--ink-faint);
  margin-right: 6px;
}
.evidence-inline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: var(--ink-mid);
  display: block;
}
.record-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--ink-faint);
}
.record-foot .integrity { font-style: italic; }
.record-foot .id { font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }

.closing { padding: 32px 56px; margin-top: 32px; border-top: 2px solid var(--ink); }
.closing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 40px; margin-bottom: 20px; }
.closing-item .meta-label { margin-bottom: 4px; }
.closing-statement { font-size: 11.5px; color: var(--ink-light); line-height: 1.6; font-style: italic; border-top: 1px solid var(--rule-light); padding-top: 16px; }

@media print {
  body { background: white; padding: 0; max-width: 100%; }
  .cover { padding: 40px 44px 32px; }
  .section-header, .index-container, .records-container, .closing { padding-left: 44px; padding-right: 44px; }
  .record { break-inside: avoid; page-break-inside: avoid; }
  .month-divider { break-after: avoid; page-break-after: avoid; }
}
`;

// ─── Renderer ─────────────────────────────────────────────────

export function renderTemplateHtml(input: TemplateRenderInput): string {
  const now = new Date();
  const exportId = exportIdFor(now);
  const exportGenerated = format(now, 'd MMMM yyyy, HH:mm');

  // Filter + sort chronologically (incident_date asc, then time asc).
  const records = input.incidents
    .filter(i => !i.voided_at && !i.excluded_from_rep)
    .slice()
    .sort((a, b) => {
      const da = `${a.incident_date}T${a.incident_time || '00:00'}`;
      const db = `${b.incident_date}T${b.incident_time || '00:00'}`;
      return da.localeCompare(db);
    });

  const total = records.length;

  // Period
  let period = '—';
  if (total > 0) {
    period = `${fmtDateShort(records[0].incident_date)} – ${fmtDateShort(records[total - 1].incident_date)}`;
  }

  // Counts
  const incidentCount = records.filter(r => !isDaily(r)).length;
  const dailyCount = records.filter(r => isDaily(r)).length;
  let recordTypeLabel = 'Records';
  if (incidentCount > 0 && dailyCount === 0) recordTypeLabel = 'Incident records';
  else if (dailyCount > 0 && incidentCount === 0) recordTypeLabel = 'Daily records';
  else if (incidentCount > 0 && dailyCount > 0) recordTypeLabel = `Incident records (${incidentCount}) · Daily records (${dailyCount})`;

  const catCounts: Record<string, number> = {};
  records.forEach(r => {
    const c = isDaily(r) ? 'Daily record' : displayCategory(r.category);
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const categoriesPresent = Object.keys(catCounts).join(' · ') || '—';
  const categoryBreakdown =
    Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c}: ${n}`)
      .join(' \u00A0·\u00A0 ') || '—';

  // ── Build HTML ──
  let html = '';
  html += `<!DOCTYPE html><html lang="en"><head>`;
  html += `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">`;
  html += `<title>Chronicle — Structured Record</title>`;
  html += `<link rel="preconnect" href="https://fonts.googleapis.com">`;
  html += `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
  html += `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&display=swap" rel="stylesheet">`;
  html += `<style>${CSS}</style></head><body>`;

  // ── COVER ──
  html += `<div class="cover">`;
  html += `<p class="cover-label">Project Chronicle · Structured Record Export</p>`;
  html += `<h1>Personal Record<br>of Events</h1>`;
  html += `<div class="cover-meta-grid">`;
  html += coverItem('Total records', String(total));
  html += coverItem('Record type', esc(recordTypeLabel));
  html += coverItem('Period covered', esc(period));
  html += coverItem('Export generated', esc(exportGenerated));
  html += coverItem('Categories present', esc(categoriesPresent));
  html += coverItem('Export ID', `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px">${esc(exportId)}</span>`, true);
  html += `</div>`;
  html += `<div class="cover-statement">This document contains records created by the record-holder using Project Chronicle. All entries are presented as originally recorded, in chronological order. No content has been added, edited, interpreted, or inferred. Each record includes the date of the event and the date and time it was recorded. Updates to records are appended and do not overwrite original entries. This document does not constitute legal advice.</div>`;
  html += `</div>`;

  // ── INDEX (two columns; top→bottom in col 1, then top→bottom in col 2) ──
  html += `<div class="section-header"><h2>Chronological Index</h2><span class="section-count">${total} record${total !== 1 ? 's' : ''}</span></div>`;

  type IdxItem =
    | { kind: 'month'; month: string; cont?: boolean }
    | { kind: 'row'; rec: Incident };

  const flat: IdxItem[] = [];
  let lastIndexMonth = '';
  for (const rec of records) {
    const monthKey = (safeParse(rec.incident_date) ? format(safeParse(rec.incident_date)!, 'yyyy-MM') : '');
    if (monthKey && monthKey !== lastIndexMonth) {
      lastIndexMonth = monthKey;
      flat.push({ kind: 'month', month: fmtMonthYear(rec.incident_date) });
    }
    flat.push({ kind: 'row', rec });
  }

  // Split: roughly half the ROWS go to col 1, the rest to col 2.
  // Month-headers don't count toward the row total.
  const totalRows = flat.filter(i => i.kind === 'row').length;
  const halfRows = Math.ceil(totalRows / 2);
  const col1: IdxItem[] = [];
  const col2: IdxItem[] = [];
  let rowsSeen = 0;
  let splitMonth = '';
  for (const item of flat) {
    if (rowsSeen < halfRows) {
      col1.push(item);
      if (item.kind === 'row') {
        rowsSeen++;
        const mk = safeParse(item.rec.incident_date) ? format(safeParse(item.rec.incident_date)!, 'yyyy-MM') : '';
        splitMonth = mk ? fmtMonthYear(item.rec.incident_date) : splitMonth;
      } else {
        splitMonth = item.month;
      }
    } else {
      col2.push(item);
    }
  }
  // If column 2 doesn't open with a month header, prepend a "(cont.)" marker
  // so the reader sees the timeline continues from column 1.
  const col2OpensWithMonth = col2[0]?.kind === 'month';
  if (!col2OpensWithMonth && splitMonth && col2.some(i => i.kind === 'row')) {
    col2.unshift({ kind: 'month', month: splitMonth, cont: true });
  }

  const renderCol = (items: IdxItem[]): string => {
    let h = '';
    h += `<table class="index-table">`;
    h += `<colgroup><col class="cg-date"><col class="cg-time"><col class="cg-cat"><col class="cg-sum"><col class="cg-id"></colgroup>`;
    h += `<thead><tr><th>Date</th><th>Time</th><th>Category</th><th>Summary</th><th>ID</th></tr></thead><tbody>`;
    for (const it of items) {
      if (it.kind === 'month') {
        h += `<tr class="index-month-row"><td colspan="5"><span class="index-month-label">${esc(it.month)}</span>${it.cont ? `<span class="index-month-cont">(cont.)</span>` : ''}</td></tr>`;
      } else {
        const rec = it.rec;
        const cat = isDaily(rec) ? 'Daily record' : displayCategory(rec.category);
        h += `<tr>`;
        h += `<td><span class="index-date">${esc(fmtDateShort(rec.incident_date))}</span></td>`;
        h += `<td><span class="index-date">${esc(rec.incident_time || '')}</span></td>`;
        h += `<td><span class="index-cat">${esc(cat)}</span></td>`;
        h += `<td><span class="index-title">${esc(indexSummary(rec))}</span></td>`;
        h += `<td><span class="index-id">${esc(rec.id.slice(0, 8).toUpperCase())}</span></td>`;
        h += `</tr>`;
      }
    }
    h += `</tbody></table>`;
    return h;
  };

  html += `<div class="index-container"><div class="index-grid">`;
  html += `<div class="index-col">${renderCol(col1)}</div>`;
  html += `<div class="index-col">${renderCol(col2)}</div>`;
  html += `</div></div>`;

  // ── FULL RECORD ──
  html += `<div class="section-header"><h2>Full Record</h2><span class="section-count">Chronological · ${total} ${total === 1 ? 'entry' : 'entries'}</span></div>`;
  html += `<div class="records-container">`;
  let lastCardMonth = '';
  for (const rec of records) {
    const monthKey = (safeParse(rec.incident_date) ? format(safeParse(rec.incident_date)!, 'yyyy-MM') : '');
    if (monthKey && monthKey !== lastCardMonth) {
      lastCardMonth = monthKey;
      html += `<div class="month-divider"><span class="month-divider-label">${esc(fmtMonthYear(rec.incident_date))}</span><div class="month-divider-rule"></div></div>`;
    }
    html += renderRecordCard(rec, input.followUps, input.evidence);
  }
  html += `</div>`;

  // ── CLOSING ──
  html += `<div class="closing"><div class="closing-grid">`;
  html += closingItem('Total records in this export', String(total));
  html += closingItem('Period covered', esc(period));
  html += closingItem('Category breakdown', `<span style="font-weight:400;font-size:13px">${categoryBreakdown}</span>`, true);
  html += closingItem('Export generated', esc(exportGenerated));
  html += `</div>`;
  html += `<p class="closing-statement">This document presents records as entered by the record-holder. No content has been added, summarised, interpreted, or inferred. Counts and classifications are derived from structured fields only. This document does not constitute legal advice and should not be treated as such. Project Chronicle v${esc(APP_VERSION)}.</p>`;
  html += `</div>`;

  html += `</body></html>`;
  return html;
}

function coverItem(label: string, value: string, raw = false): string {
  return `<div class="cover-meta-item"><p class="meta-label">${esc(label)}</p><p class="meta-value">${raw ? value : value}</p></div>`;
}

function closingItem(label: string, value: string, raw = false): string {
  return `<div class="closing-item"><p class="meta-label">${esc(label)}</p><p class="meta-value">${raw ? value : value}</p></div>`;
}

function renderRecordCard(inc: Incident, allFollowUps: FollowUpNote[], allEvidence: EvidenceFile[]): string {
  const slug = isDaily(inc) ? 'unclassified' : categorySlug(inc.category);
  const dateStr = fmtDateLong(inc.incident_date);
  const timeStr = inc.incident_time ? `<span class="time">${esc(inc.incident_time)}</span>` : '';
  const classification = classificationLine(inc);

  let recordedHtml = '';
  const recAt = safeParse(inc.created_at);
  if (recAt) {
    recordedHtml += `<div class="recorded-date">Recorded ${esc(fmtRecorded(inc.created_at))}</div>`;
    const evtDate = safeParse(inc.incident_date);
    if (evtDate) {
      const gap = differenceInCalendarDays(recAt, evtDate);
      if (gap > 0) {
        recordedHtml += `<div class="recorded-gap">${gap} day${gap === 1 ? '' : 's'} after event</div>`;
      } else if (gap === 0) {
        recordedHtml += `<div class="recorded-gap">Recorded same day</div>`;
      }
    }
  }

  let html = `<div class="record-card" data-incident-id="${esc(inc.id)}"${isDaily(inc) ? ' data-record-type="daily_record"' : ''}>`;
  html += `<div class="record-header">`;
  html += `<div class="record-type-bar ${slug}"></div>`;
  html += `<div class="record-header-content">`;
  html += `<div><div class="record-datetime">${esc(dateStr)} ${timeStr}</div>`;
  if (classification) html += `<div class="record-classification">${esc(classification)}</div>`;
  html += `</div>`;
  html += `<div class="record-provenance">${recordedHtml}</div>`;
  html += `</div></div>`;

  // Body
  html += `<div class="record-body">`;

  if (inc.people_involved && inc.people_involved.length > 0) {
    html += `<div class="record-field"><p class="field-label">People involved</p><p class="field-value">${esc(inc.people_involved.join(', '))}</p></div>`;
  }

  const narrativeLabel = isDaily(inc) ? 'Record entry' : 'User-provided account';
  const narrative = (inc.raw_narrative || '').trim();
  if (narrative) {
    html += `<div class="record-field"><p class="field-label">${esc(narrativeLabel)}</p><p class="narrative-text">${esc(narrative)}</p></div>`;
  }

  if (!isDaily(inc) && inc.exact_words && inc.exact_words.trim().length > 0) {
    const ew = inc.exact_words.trim().replace(/^["“”]+|["“”]+$/g, '');
    html += `<div class="exact-words-block"><p class="field-label">Exact words recorded</p><p class="exact-words-text">"${esc(ew)}"</p></div>`;
  }

  // Daily record interactions
  const interactionsRaw = (inc as any).interactions;
  if (isDaily(inc) && Array.isArray(interactionsRaw) && interactionsRaw.length > 0) {
    html += `<div class="record-field"><p class="field-label">Notable interactions</p>`;
    interactionsRaw.forEach((it: any) => {
      const parts: string[] = [];
      if (it.time) parts.push(esc(it.time));
      if (it.type) parts.push(esc(it.type));
      if (it.who) parts.push(esc(it.who));
      if (it.context) parts.push(esc(it.context));
      html += `<p class="field-value">— ${parts.join(' — ')}</p>`;
    });
    html += `</div>`;
  }

  // Follow-ups
  const fus = allFollowUps.filter(f => f.incident_id === inc.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (fus.length > 0) {
    html += `<div class="record-field"><p class="field-label">Follow-ups</p>`;
    fus.forEach(fu => {
      html += `<div class="followup-entry" data-followup-id="${esc(fu.id)}"><span class="followup-date">${esc(fmtRecorded(fu.created_at))}</span><span class="followup-text">${esc(fu.note_text)}</span></div>`;
    });
    html += `</div>`;
  }

  // Evidence
  const evs = allEvidence.filter(e => e.incident_id === inc.id);
  if (evs.length > 0) {
    html += `<div class="record-field"><p class="field-label">Attachments</p>`;
    evs.forEach(ev => {
      const ref = ev.evidence_ref_number != null ? `E${String(ev.evidence_ref_number).padStart(2, '0')}` : 'E—';
      html += `<div class="evidence-entry">${esc(ref)} — ${esc(ev.file_name)}</div>`;
    });
    html += `</div>`;
  }

  html += `</div>`; // /record-body

  // Footer
  html += `<div class="record-footer">`;
  html += `<span class="integrity-note">Original content preserved · Updates appended without overwriting</span>`;
  html += `<span class="record-id">${esc(inc.id.slice(0, 8).toUpperCase())}</span>`;
  html += `</div>`;

  html += `</div>`; // /record-card
  return html;
}

export function getTemplateFilename(): string {
  const now = new Date();
  return `chronicle-record-${format(now, 'yyyy-MM-dd-HHmm')}.html`;
}
