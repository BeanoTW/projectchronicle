import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// Helpers (deterministic only – no interpretation)
// ─────────────────────────────────────────────────────────────

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeArray(val: unknown): string[] {
  if (Array.isArray(val))
    return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return [];
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Expect YYYY-MM-DD; fall back to Date parser otherwise.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseEventDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null {
  const d = parseEventDate(dateStr);
  if (!d) return null;
  if (timeStr) {
    const tm = /^(\d{1,2}):(\d{2})/.exec(timeStr);
    if (tm) {
      d.setHours(Number(tm[1]));
      d.setMinutes(Number(tm[2]));
    }
  }
  return d;
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLongDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRecordedStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}

function formatExportStamp(d: Date): string {
  const day = d.getDate();
  const mon = MONTHS_LONG[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}

function monthLabel(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function daysBetween(eventISO: Date, recordedISO: Date): number {
  const oneDay = 86400000;
  const e = new Date(eventISO.getFullYear(), eventISO.getMonth(), eventISO.getDate()).getTime();
  const r = new Date(recordedISO.getFullYear(), recordedISO.getMonth(), recordedISO.getDate()).getTime();
  return Math.max(0, Math.round((r - e) / oneDay));
}

function shortId(uuid: string): string {
  if (!uuid) return "";
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Category → CSS class for left border bar
function categoryClass(cat: string | null | undefined): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("communication")) return "communication";
  if (c.includes("action") || c.includes("change")) return "action";
  if (c.includes("process")) return "process";
  if (c.includes("working")) return "working";
  return "unclassified";
}

function categoryDisplay(cat: string | null | undefined): string {
  if (!cat || !cat.trim()) return "Unclassified";
  return cat;
}

// Index summary: short, scannable phrase (~4–8 words) ending on a word boundary.
// Never mid-word truncation like "Manag…". Always end after a meaningful chunk.
function indexSummary(inc: any, eventDate: Date | null): string {
  const source =
    (inc.title && String(inc.title).trim()) ||
    (inc.raw_narrative && String(inc.raw_narrative).trim()) ||
    "";
  if (source) {
    const firstSentence = source.split(/(?<=[.!?])\s+/)[0] || source;
    const oneLine = firstSentence.replace(/\s+/g, " ").trim();
    const words = oneLine.split(" ");
    const TARGET_WORDS = 8;
    const MAX_CHARS = 52;
    if (words.length <= TARGET_WORDS && oneLine.length <= MAX_CHARS) return oneLine;
    // Take up to TARGET_WORDS but stay within MAX_CHARS at a word boundary.
    let acc = "";
    for (let i = 0; i < Math.min(words.length, TARGET_WORDS); i++) {
      const next = acc ? acc + " " + words[i] : words[i];
      if (next.length > MAX_CHARS) break;
      acc = next;
    }
    if (!acc) acc = words[0].slice(0, MAX_CHARS); // single very long word fallback
    return acc + "…";
  }
  const dateStr = eventDate ? formatShortDate(eventDate) : "";
  const cat = inc.category && String(inc.category).trim() ? inc.category : "Unclassified";
  return dateStr ? `${cat} — ${dateStr}` : cat;
}
// Backwards alias (used elsewhere if any)
const indexTitle = indexSummary;

// Classification line: "Category → Subtype · Location"
function classificationLine(inc: any): string {
  const cat = categoryDisplay(inc.category);
  const sub = inc.subtype && String(inc.subtype).trim() ? String(inc.subtype).trim() : "";
  const loc = inc.location && String(inc.location).trim() ? String(inc.location).trim() : "";
  const parts: string[] = [];
  if (sub) parts.push(`${cat} → ${sub}`);
  else parts.push(cat);
  if (loc) parts.push(loc);
  return parts.join(" · ");
}

// ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const incidentId: string | undefined = body?.incidentId;

    let q = supabase.from("incidents").select("*").eq("user_id", user.id);
    if (incidentId) q = q.eq("id", incidentId);
    const { data: incidentsRaw, error: incError } = await q;
    if (incError) throw new Error(`Failed to fetch incidents: ${incError.message}`);

    const incidents = (incidentsRaw || []).filter((i: any) => !i.voided_at && !i.excluded_from_rep);

    // ── Deterministic chronological sort ──
    incidents.sort((a: any, b: any) => {
      const da = parseEventDateTime(a.incident_date, a.incident_time)?.getTime() ?? 0;
      const db = parseEventDateTime(b.incident_date, b.incident_time)?.getTime() ?? 0;
      if (da !== db) return da - db;
      const ra = new Date(a.created_at || 0).getTime();
      const rb = new Date(b.created_at || 0).getTime();
      if (ra !== rb) return ra - rb;
      return String(a.id).localeCompare(String(b.id));
    });

    const now = new Date();
    const exportStamp = formatExportStamp(now);

    // Period covered
    let periodCovered = "—";
    if (incidents.length > 0) {
      const first = parseEventDate(incidents[0].incident_date);
      const last = parseEventDate(incidents[incidents.length - 1].incident_date);
      if (first && last) {
        periodCovered = first.getTime() === last.getTime()
          ? formatShortDate(first)
          : `${formatShortDate(first)} – ${formatShortDate(last)}`;
      }
    }

    // Categories present (deduped, in spec order)
    const SPEC_ORDER = ["Communication", "Action / Change", "Process Event", "Working Conditions", "Unclassified"];
    const presentSet = new Set<string>();
    const counts: Record<string, number> = {};
    for (const inc of incidents) {
      const display = categoryDisplay(inc.category);
      // Normalise to spec label if possible
      const normalised = SPEC_ORDER.find(s => s.toLowerCase() === display.toLowerCase()) || display;
      presentSet.add(normalised);
      counts[normalised] = (counts[normalised] || 0) + 1;
    }
    const categoriesPresent = SPEC_ORDER.filter(s => presentSet.has(s));
    for (const c of presentSet) if (!categoriesPresent.includes(c)) categoriesPresent.push(c);

    // Record type
    const allDaily = incidents.length > 0 && incidents.every((i: any) => i.record_type === "daily_record");
    const allIncident = incidents.length > 0 && incidents.every((i: any) => (i.record_type || "incident") === "incident");
    const recordTypeLabel = allDaily ? "Daily records" : allIncident ? "Incident records" : "Incident & daily records";

    // Export ID
    const exportId = `CHR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    // ── Build INDEX rows (split into two columns: top→bottom in col1, then col2) ──
    type IdxItem = { kind: "month" | "row"; month?: string; html?: string };
    const flatIndex: IdxItem[] = [];
    let lastMonth = "";
    for (const inc of incidents) {
      const ed = parseEventDate(inc.incident_date);
      const mLabel = ed ? monthLabel(ed) : "Undated";
      if (mLabel !== lastMonth) {
        flatIndex.push({ kind: "month", month: mLabel });
        lastMonth = mLabel;
      }
      const dateCell = ed ? formatShortDate(ed) : "—";
      const timeCell = inc.incident_time && String(inc.incident_time).trim() ? String(inc.incident_time).trim() : "—";
      const catCell = categoryDisplay(inc.category);
      const summaryCell = indexSummary(inc, ed);
      const idCell = shortId(inc.id);
      flatIndex.push({
        kind: "row",
        month: mLabel,
        html: `<tr>
          <td class="c-date"><span class="index-date">${escapeHtml(dateCell)}</span></td>
          <td class="c-time"><span class="index-date">${escapeHtml(timeCell)}</span></td>
          <td class="c-cat"><span class="index-cat">${escapeHtml(catCell)}</span></td>
          <td class="c-sum"><span class="index-title">${escapeHtml(summaryCell)}</span></td>
          <td class="c-id"><span class="index-id">${escapeHtml(idCell)}</span></td>
        </tr>`,
      });
    }

    // Split point: roughly half the rows go to column 1, remainder to column 2.
    const totalRows = flatIndex.filter(x => x.kind === "row").length;
    const halfRows = Math.ceil(totalRows / 2);
    const col1Items: IdxItem[] = [];
    const col2Items: IdxItem[] = [];
    let rowsSeen = 0;
    let splitMonth = "";
    for (const item of flatIndex) {
      if (rowsSeen < halfRows) {
        col1Items.push(item);
        if (item.kind === "row") {
          rowsSeen++;
          splitMonth = item.month || "";
        }
      } else {
        col2Items.push(item);
      }
    }
    // Trim trailing month header from col1 if no rows under it
    while (col1Items.length && col1Items[col1Items.length - 1].kind === "month") col1Items.pop();
    // If col2 doesn't start with a month header, prepend continuation header
    const col2StartsWithMonth = col2Items[0]?.kind === "month";
    if (!col2StartsWithMonth && splitMonth) {
      col2Items.unshift({ kind: "month", month: `${splitMonth} (cont.)` });
    }

    function renderIndexCol(items: IdxItem[]): string {
      if (items.length === 0) return "";
      const out: string[] = [];
      out.push(`<table class="index-table"><colgroup>
        <col class="cg-date"><col class="cg-time"><col class="cg-cat"><col class="cg-sum"><col class="cg-id">
      </colgroup><thead><tr>
        <th>Date</th><th>Time</th><th>Category</th><th>Summary</th><th>Record ID</th>
      </tr></thead><tbody>`);
      for (const it of items) {
        if (it.kind === "month") {
          out.push(`<tr class="index-month-row"><td colspan="5"><span class="index-month-label">${escapeHtml(it.month || "")}</span></td></tr>`);
        } else {
          out.push(it.html || "");
        }
      }
      out.push(`</tbody></table>`);
      return out.join("");
    }

    const indexColumn1Html = renderIndexCol(col1Items);
    const indexColumn2Html = renderIndexCol(col2Items);

    // ── Build FULL RECORD section (cards + month dividers) — strictly single column ──
    lastMonth = "";
    const recordCards: string[] = [];
    for (const inc of incidents) {
      const ed = parseEventDate(inc.incident_date);
      const mLabel = ed ? monthLabel(ed) : "Undated";
      if (mLabel !== lastMonth) {
        recordCards.push(`<div class="month-divider">
          <span class="month-divider-label">${escapeHtml(mLabel)}</span>
          <div class="month-divider-rule"></div>
        </div>`);
        lastMonth = mLabel;
      }

      const catClass = categoryClass(inc.category);
      const longDate = ed ? formatLongDate(ed) : "";
      const time = inc.incident_time && String(inc.incident_time).trim() ? String(inc.incident_time).trim() : "";
      const classification = classificationLine(inc);

      const recordedISO = inc.created_at;
      const recordedDate = parseEventDate((recordedISO || "").slice(0, 10));
      const recordedStamp = formatRecordedStamp(recordedISO);
      let gapLine = "";
      if (ed && recordedDate) {
        const gap = daysBetween(ed, recordedDate);
        gapLine = gap === 0 ? "Same day as event" : `${gap} day${gap === 1 ? "" : "s"} after event`;
      }

      const people = safeArray(inc.people_involved);
      const narrative = (inc.raw_narrative || "").trim();
      const exact = (inc.exact_words || "").trim();

      const fields: string[] = [];
      if (people.length > 0) {
        fields.push(`<div class="record-field">
          <p class="field-label">People involved</p>
          <p class="field-value">${escapeHtml(people.join(", "))}</p>
        </div>`);
      }
      if (narrative) {
        fields.push(`<div class="record-field">
          <p class="field-label">User-provided account</p>
          <p class="narrative-text">${escapeHtml(narrative)}</p>
        </div>`);
      }
      if (exact) {
        fields.push(`<div class="exact-words-block">
          <p class="field-label">Exact words recorded</p>
          <p class="exact-words-text">${escapeHtml(exact)}</p>
        </div>`);
      }

      recordCards.push(`<div class="record-card">
        <div class="record-header">
          <div class="record-type-bar ${catClass}"></div>
          <div class="record-header-content">
            <div>
              <div class="record-datetime">${escapeHtml(longDate)}${time ? ` <span class="time">${escapeHtml(time)}</span>` : ""}</div>
              <div class="record-classification">${escapeHtml(classification)}</div>
            </div>
            <div class="record-provenance">
              ${recordedStamp ? `<div class="recorded-date">Recorded ${escapeHtml(recordedStamp)}</div>` : ""}
              ${gapLine ? `<div class="recorded-gap">${escapeHtml(gapLine)}</div>` : ""}
            </div>
          </div>
        </div>
        <div class="record-body">
          ${fields.join("\n")}
        </div>
        <div class="record-footer">
          <span class="integrity-note">Original content preserved · Updates appended without overwriting</span>
          <span class="record-id">${escapeHtml(shortId(inc.id))}</span>
        </div>
      </div>`);
    }

    const categoryBreakdown = categoriesPresent
      .map(c => `${c}: ${counts[c] || 0}`)
      .join(" &nbsp;·&nbsp; ");

    // ── Final HTML (matches reference template) ──
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chronicle — Structured Record</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1C1C1E;
    --ink-mid: #3A3A3C;
    --ink-light: #6C6C70;
    --ink-faint: #AEAEB2;
    --rule: #D1D1D6;
    --rule-light: #E5E5EA;
    --bg: #FAFAF8;
    --bg-tint: #F2F2F0;
    --bg-card: #FFFFFF;
    --accent: #2C5F2E;
    --accent-light: #EAF2EA;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Source Serif 4', Georgia, serif;
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.7;
    max-width: 880px;
    margin: 0 auto;
    padding: 0 0 80px;
  }
  /* Cover, Full Record and Closing remain single-column */
  .cover, .closing,
  .records-container { max-width: 820px; margin-left: auto; margin-right: auto; }
  .section-header { max-width: 820px; margin-left: auto; margin-right: auto; }
  .section-header.index-section { max-width: 880px; }
  /* Two-column ledger index */
  .index-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; margin-top: 16px; }
  .index-col { min-width: 0; }
  .index-table { table-layout: fixed; width: 100%; border-collapse: collapse; }
  .index-table colgroup .cg-date { width: 26%; }
  .index-table colgroup .cg-time { width: 13%; }
  .index-table colgroup .cg-cat  { width: 22%; }
  .index-table colgroup .cg-sum  { width: 27%; }
  .index-table colgroup .cg-id   { width: 12%; }
  .index-table th, .index-table td { padding: 6px 5px !important; line-height: 1.35; vertical-align: middle; overflow: hidden; }
  .index-table th { font-size: 8.5px !important; }
  .index-table .index-date { font-size: 10px; }
  .index-table .index-cat { font-size: 10px; }
  .index-table .index-title { font-size: 11px; }
  .index-table .index-id { font-size: 9px; }
  .index-table .c-id, .c-id .index-id, .index-table th:last-child { text-align: right; }
  .index-table .c-sum { text-overflow: ellipsis; white-space: nowrap; }
  .index-table .c-date, .index-table .c-time, .index-table .c-cat { white-space: nowrap; text-overflow: ellipsis; }
  .cover { padding: 64px 56px 48px; border-bottom: 2px solid var(--ink); position: relative; }
  .cover-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin-bottom: 24px; }
  .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 36px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 32px; }
  .cover-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid var(--rule); margin-top: 32px; }
  .cover-meta-item { padding: 14px 0; border-bottom: 1px solid var(--rule-light); }
  .cover-meta-item:nth-child(odd) { padding-right: 32px; border-right: 1px solid var(--rule-light); }
  .cover-meta-item:nth-child(even) { padding-left: 32px; }
  .meta-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 3px; }
  .meta-value { font-size: 13px; font-weight: 600; color: var(--ink); }
  .cover-statement { margin-top: 28px; padding: 16px 20px; background: var(--bg-tint); border-left: 3px solid var(--accent); font-size: 12.5px; color: var(--ink-mid); line-height: 1.65; font-style: italic; }
  .section-header { padding: 20px 56px 12px; border-bottom: 1px solid var(--rule); margin-top: 48px; display: flex; align-items: baseline; gap: 16px; }
  .section-header h2 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: var(--ink); }
  .section-count { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-faint); letter-spacing: 0.1em; }
  .index-container { padding: 0 32px; margin-top: 8px; }
  .index-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .index-table thead tr { border-bottom: 1px solid var(--rule); }
  .index-table th { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; padding: 8px 12px 8px 0; text-align: left; }
  .index-table th:last-child { padding-right: 0; }
  .index-table tbody tr { border-bottom: 1px solid var(--rule-light); }
  .index-table td { padding: 9px 12px 9px 0; font-size: 12.5px; color: var(--ink-mid); vertical-align: top; }
  .index-table td:last-child { padding-right: 0; }
  .index-date { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink); font-weight: 500; white-space: nowrap; }
  .index-cat { font-size: 11px; color: var(--ink-mid); white-space: nowrap; }
  .index-title { font-size: 12.5px; color: var(--ink); }
  .index-id { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--ink-faint); white-space: nowrap; }
  .index-month-row td { padding-top: 16px; padding-bottom: 4px; }
  .index-month-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 500; }
  .records-container { padding: 0 56px; margin-top: 8px; }
  .month-divider { margin-top: 40px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; }
  .month-divider-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); white-space: nowrap; }
  .month-divider-rule { flex: 1; height: 1px; background: var(--rule-light); }
  .record-card { background: var(--bg-card); border: 1px solid var(--rule); border-radius: 4px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
  .record-header { display: flex; align-items: stretch; border-bottom: 1px solid var(--rule-light); }
  .record-type-bar { width: 4px; background: var(--ink-mid); flex-shrink: 0; }
  .record-type-bar.communication { background: #2C5F2E; }
  .record-type-bar.action        { background: #1D4E89; }
  .record-type-bar.process       { background: #6B4C11; }
  .record-type-bar.working       { background: #5C1A1A; }
  .record-type-bar.unclassified  { background: #D1D1D6; }
  .record-header-content { flex: 1; padding: 14px 16px 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .record-datetime { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 500; color: var(--ink); line-height: 1.3; }
  .record-datetime .time { font-size: 11px; color: var(--ink-light); margin-left: 8px; }
  .record-classification { font-size: 11px; color: var(--ink-light); margin-top: 2px; }
  .record-provenance { text-align: right; flex-shrink: 0; }
  .recorded-date { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-faint); line-height: 1.4; }
  .recorded-gap { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--ink-faint); }
  .record-body { padding: 14px 16px 14px 20px; }
  .record-field { margin-bottom: 12px; }
  .record-field:last-child { margin-bottom: 0; }
  .field-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 4px; }
  .field-value { font-size: 13px; color: var(--ink-mid); }
  .narrative-text { font-size: 13.5px; line-height: 1.75; color: var(--ink); white-space: pre-wrap; }
  .exact-words-block { margin-top: 12px; padding: 10px 16px; background: var(--bg-tint); border-left: 3px solid var(--rule); }
  .exact-words-block .field-label { margin-bottom: 6px; }
  .exact-words-text { font-family: 'Source Serif 4', Georgia, serif; font-style: italic; font-size: 13px; color: var(--ink-mid); line-height: 1.6; }
  .record-footer { padding: 8px 16px; background: var(--bg-tint); border-top: 1px solid var(--rule-light); display: flex; justify-content: space-between; align-items: center; }
  .integrity-note { font-size: 10.5px; color: var(--ink-faint); font-style: italic; }
  .record-id { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--ink-faint); letter-spacing: 0.05em; }
  .closing { padding: 40px 56px; margin-top: 40px; border-top: 2px solid var(--ink); }
  .closing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 48px; margin-bottom: 24px; }
  .closing-item .meta-label { margin-bottom: 4px; }
  .closing-statement { font-size: 12px; color: var(--ink-light); line-height: 1.65; font-style: italic; border-top: 1px solid var(--rule-light); padding-top: 20px; }
  @media print {
    body { background: white; padding: 0; max-width: 100%; }
    .cover { padding: 48px 48px 36px; }
    .section-header, .index-container, .records-container, .closing { padding-left: 48px; padding-right: 48px; }
    .record-card { break-inside: avoid; page-break-inside: avoid; }
    .month-divider { break-after: avoid; }
  }
</style>
</head>
<body>

<div class="cover">
  <p class="cover-label">Project Chronicle · Structured Record Export</p>
  <h1>Personal Record<br>of Events</h1>
  <div class="cover-meta-grid">
    <div class="cover-meta-item">
      <p class="meta-label">Total records</p>
      <p class="meta-value">${incidents.length}</p>
    </div>
    <div class="cover-meta-item">
      <p class="meta-label">Record type</p>
      <p class="meta-value">${escapeHtml(recordTypeLabel)}</p>
    </div>
    <div class="cover-meta-item">
      <p class="meta-label">Period covered</p>
      <p class="meta-value">${escapeHtml(periodCovered)}</p>
    </div>
    <div class="cover-meta-item">
      <p class="meta-label">Export generated</p>
      <p class="meta-value">${escapeHtml(exportStamp)}</p>
    </div>
    <div class="cover-meta-item">
      <p class="meta-label">Categories present</p>
      <p class="meta-value">${categoriesPresent.length > 0 ? categoriesPresent.map(escapeHtml).join(" · ") : "—"}</p>
    </div>
    <div class="cover-meta-item">
      <p class="meta-label">Export ID</p>
      <p class="meta-value" style="font-family:'IBM Plex Mono',monospace;font-size:11px">${escapeHtml(exportId)}</p>
    </div>
  </div>
  <div class="cover-statement">
    This document contains records created by the record-holder using Project Chronicle. All entries are presented as originally recorded, in chronological order. No content has been added, edited, interpreted, or inferred. Each record includes the date of the event and the date and time it was recorded. Updates to records are appended and do not overwrite original entries. This document does not constitute legal advice.
  </div>
</div>

<div class="section-header index-section">
  <span class="section-count">${incidents.length} record${incidents.length === 1 ? "" : "s"}</span>
</div>

<div class="index-container">
  <div class="index-grid">
    <div class="index-col">${indexColumn1Html}</div>
    <div class="index-col">${indexColumn2Html}</div>
  </div>
</div>

<div class="section-header">
  <h2>Full Record</h2>
  <span class="section-count">${incidents.length} record${incidents.length === 1 ? "" : "s"}</span>
</div>

<div class="records-container">
  ${recordCards.join("\n")}
</div>

<div class="closing">
  <div class="closing-grid">
    <div class="closing-item">
      <p class="meta-label">Total records in this export</p>
      <p class="meta-value">${incidents.length}</p>
    </div>
    <div class="closing-item">
      <p class="meta-label">Period covered</p>
      <p class="meta-value">${escapeHtml(periodCovered)}</p>
    </div>
    <div class="closing-item">
      <p class="meta-label">Category breakdown</p>
      <p class="meta-value" style="font-weight:400;font-size:13px">${categoryBreakdown || "—"}</p>
    </div>
    <div class="closing-item">
      <p class="meta-label">Export generated</p>
      <p class="meta-value">${escapeHtml(exportStamp)}</p>
    </div>
  </div>
  <p class="closing-statement">
    This document presents records as entered by the record-holder. No content has been added, summarised, interpreted, or inferred. Counts and classifications are derived from structured fields only. This document does not constitute legal advice and should not be treated as such. Project Chronicle.
  </p>
</div>

</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Chronicle_Structured_Record.html"`,
      },
    });
  } catch (e) {
    console.error("generate-export error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
