import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string" && v.length > 0);
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { exportType, incidentId } = await req.json();

    // ── Fetch user-scoped incidents ──
    let incidentsQuery = supabase
      .from("incidents")
      .select("*")
      .eq("user_id", user.id)
      .order("incident_date", { ascending: true });

    if (incidentId) {
      incidentsQuery = incidentsQuery.eq("id", incidentId);
    }

    const { data: incidents, error: incError } = await incidentsQuery;
    if (incError) {
      throw new Error(`Failed to fetch incidents: ${incError.message}`);
    }

    // ── Fetch user-scoped evidence ──
    const { data: evidence, error: evError } = await supabase
      .from("evidence_files")
      .select("*")
      .eq("user_id", user.id);
    if (evError) {
      throw new Error(`Failed to fetch evidence: ${evError.message}`);
    }

    const safeIncidents = incidents || [];
    const safeEvidence = evidence || [];

    // ── HTML generation ──
    let htmlContent = "";
    const title =
      exportType === "incident"
        ? "Incident Report"
        : exportType === "chronology"
          ? "Incident Chronology"
          : exportType === "evidence-index"
            ? "Evidence Index"
            : "Full Case Bundle";

    const css = `
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1A2332; line-height: 1.6; }
      h1 { font-size: 24px; border-bottom: 2px solid #1A7A6E; padding-bottom: 8px; color: #1A2332; }
      h2 { font-size: 18px; color: #1A7A6E; margin-top: 24px; }
      h3 { font-size: 14px; color: #1A2332; margin-top: 16px; }
      .meta { color: #6B7280; font-size: 12px; margin-bottom: 4px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; margin-right: 4px; }
      .severity-critical { background: #FEE2E2; color: #991B1B; }
      .severity-serious { background: #FEF3C7; color: #B45309; }
      .severity-moderate { background: #FEF3C7; color: #92400E; }
      .severity-low { background: #D1FAE5; color: #065F46; }
      .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .narrative { background: #F9FAFB; padding: 12px; border-radius: 6px; font-size: 14px; white-space: pre-wrap; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #E5E7EB; padding: 8px 12px; font-size: 13px; text-align: left; }
      th { background: #F3F4F6; font-weight: 600; }
      .disclaimer { margin-top: 40px; padding: 12px; background: #FFFBEB; border-radius: 6px; font-size: 11px; color: #92400E; }
      .cover { text-align: center; padding: 80px 20px; }
      .cover h1 { border: none; font-size: 32px; }
      .page-break { page-break-after: always; }
    `;

    const generatedDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (exportType === "incident" && safeIncidents.length === 1) {
      const inc = safeIncidents[0];
      const people = safeArray(inc.people_involved);
      const witnesses = safeArray(inc.witnesses);
      const linkedEvidence = safeEvidence.filter((e) => e.incident_id === inc.id);
      const narrative = inc.raw_narrative || "";

      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Incident Report</title><style>${css}</style></head><body>
        <h1>Incident Report</h1>
        <p class="meta">Generated: ${generatedDate}</p>
        <h2>${escapeHtml(inc.title || "Untitled Incident")}</h2>
        <p class="meta">Date: ${inc.incident_date}${inc.incident_time ? " at " + inc.incident_time : ""}${inc.location ? " — " + escapeHtml(inc.location) : ""}</p>
        ${inc.severity ? `<span class="badge severity-${inc.severity.toLowerCase()}">${escapeHtml(inc.severity)}</span>` : ""}
        ${inc.category ? `<span class="badge" style="background:#E8F4F2;color:#1A7A6E">${escapeHtml(inc.category)}</span>` : ""}
        <h3>Account of Incident</h3>
        <div class="narrative">${escapeHtml(narrative)}</div>
        ${inc.exact_words ? `<h3>Exact Wording Recorded</h3><p><em>"${escapeHtml(inc.exact_words)}"</em></p>` : ""}
        ${inc.impact_note ? `<h3>Impact</h3><p>${escapeHtml(inc.impact_note)}</p>` : ""}
        ${people.length > 0 ? `<h3>People Involved</h3><p>${people.map(escapeHtml).join(", ")}</p>` : ""}
        ${witnesses.length > 0 ? `<h3>Witnesses</h3><p>${witnesses.map(escapeHtml).join(", ")}</p>` : ""}
        ${
          linkedEvidence.length > 0
            ? `<h3>Evidence (${linkedEvidence.length} file${linkedEvidence.length > 1 ? "s" : ""})</h3>
        <table><tr><th>Ref</th><th>File</th><th>Type</th><th>Uploaded</th></tr>
        ${linkedEvidence.map((e, i) => `<tr><td>E-${String(i + 1).padStart(3, "0")}</td><td>${escapeHtml(e.file_name)}</td><td>${escapeHtml(e.file_type || "File")}</td><td>${e.upload_date?.split("T")[0] || ""}</td></tr>`).join("")}
        </table>`
            : ""
        }
        <div class="disclaimer">Project Chronicle provides documentation support only — not legal advice. Always consult a qualified employment solicitor or union representative before taking formal action.</div>
      </body></html>`;
    } else if (exportType === "chronology") {
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Incident Chronology</title><style>${css}</style></head><body>
        <h1>Incident Chronology</h1>
        <p class="meta">Generated: ${generatedDate}</p>
        <p class="meta">${safeIncidents.length} incidents recorded</p>
        ${safeIncidents
          .map((inc) => {
            const people = safeArray(inc.people_involved);
            const narrative = inc.raw_narrative || "";
            return `
          <div class="card">
            <p class="meta">${inc.incident_date}${inc.incident_time ? " at " + inc.incident_time : ""}</p>
            <h3>${escapeHtml(inc.title || "Untitled")}</h3>
            ${inc.severity ? `<span class="badge severity-${inc.severity.toLowerCase()}">${escapeHtml(inc.severity)}</span>` : ""}
            ${inc.category ? `<span class="badge" style="background:#E8F4F2;color:#1A7A6E">${escapeHtml(inc.category)}</span>` : ""}
            <p style="margin-top:8px;font-size:14px">${escapeHtml(narrative)}</p>
            ${people.length > 0 ? `<p class="meta">Involved: ${people.map(escapeHtml).join(", ")}</p>` : ""}
          </div>`;
          })
          .join("")}
        <div class="disclaimer">Project Chronicle provides documentation support only — not legal advice.</div>
      </body></html>`;
    } else if (exportType === "evidence-index") {
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Evidence Index</title><style>${css}</style></head><body>
        <h1>Evidence Index</h1>
        <p class="meta">Generated: ${generatedDate}</p>
        <p class="meta">${safeEvidence.length} evidence file${safeEvidence.length !== 1 ? "s" : ""} indexed</p>
        <table>
          <tr><th>Ref</th><th>File Name</th><th>Type</th><th>Uploaded</th><th>Linked Incident</th></tr>
          ${safeEvidence
            .map((e, i) => {
              const linked = safeIncidents.find((inc) => inc.id === e.incident_id);
              return `<tr><td>E-${String(i + 1).padStart(3, "0")}</td><td>${escapeHtml(e.file_name)}</td><td>${escapeHtml(e.file_type || "File")}</td><td>${e.upload_date?.split("T")[0] || ""}</td><td>${linked ? escapeHtml(linked.title || "Untitled") : "<em>Not linked</em>"}</td></tr>`;
            })
            .join("")}
        </table>
        <div class="disclaimer">Project Chronicle provides documentation support only — not legal advice.</div>
      </body></html>`;
    } else {
      // Full Case Bundle
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Full Case Bundle</title><style>${css}</style></head><body>
        <div class="cover">
          <h1>Case Bundle</h1>
          <p style="font-size:16px;color:#6B7280;margin-top:16px">Project Chronicle — Workplace Incident Documentation</p>
          <p style="font-size:14px;color:#6B7280;margin-top:8px">Generated: ${generatedDate}</p>
          <p style="font-size:14px;color:#6B7280">${safeIncidents.length} incidents · ${safeEvidence.length} evidence files</p>
        </div>
        <div class="page-break"></div>

        <h1>Chronology</h1>
        ${safeIncidents
          .map((inc) => {
            const people = safeArray(inc.people_involved);
            const narrative = inc.raw_narrative || "";
            return `
          <div class="card">
            <p class="meta">${inc.incident_date}${inc.incident_time ? " at " + inc.incident_time : ""}</p>
            <h3>${escapeHtml(inc.title || "Untitled")}</h3>
            ${inc.severity ? `<span class="badge severity-${inc.severity.toLowerCase()}">${escapeHtml(inc.severity)}</span>` : ""}
            ${inc.category ? `<span class="badge" style="background:#E8F4F2;color:#1A7A6E">${escapeHtml(inc.category)}</span>` : ""}
            <p style="margin-top:8px;font-size:14px">${escapeHtml(narrative)}</p>
            ${people.length > 0 ? `<p class="meta">Involved: ${people.map(escapeHtml).join(", ")}</p>` : ""}
          </div>`;
          })
          .join("")}
        <div class="page-break"></div>

        <h1>Evidence Index</h1>
        <table>
          <tr><th>Ref</th><th>File Name</th><th>Type</th><th>Uploaded</th><th>Linked Incident</th></tr>
          ${safeEvidence
            .map((e, i) => {
              const linked = safeIncidents.find((inc) => inc.id === e.incident_id);
              return `<tr><td>E-${String(i + 1).padStart(3, "0")}</td><td>${escapeHtml(e.file_name)}</td><td>${escapeHtml(e.file_type || "File")}</td><td>${e.upload_date?.split("T")[0] || ""}</td><td>${linked ? escapeHtml(linked.title || "Untitled") : "<em>Not linked</em>"}</td></tr>`;
            })
            .join("")}
        </table>
        <div class="page-break"></div>

        <h1>Full Incident Records</h1>
        ${safeIncidents
          .map((inc) => {
            const people = safeArray(inc.people_involved);
            const witnesses = safeArray(inc.witnesses);
            const linkedEvidence = safeEvidence.filter((e) => e.incident_id === inc.id);
            const narrative = inc.raw_narrative || "";
            return `
          <div class="card">
            <h2>${escapeHtml(inc.title || "Untitled Incident")}</h2>
            <p class="meta">Date: ${inc.incident_date}${inc.incident_time ? " at " + inc.incident_time : ""}${inc.location ? " — " + escapeHtml(inc.location) : ""}</p>
            ${inc.severity ? `<span class="badge severity-${inc.severity.toLowerCase()}">${escapeHtml(inc.severity)}</span>` : ""}
            ${inc.category ? `<span class="badge" style="background:#E8F4F2;color:#1A7A6E">${escapeHtml(inc.category)}</span>` : ""}
            <h3>Account</h3>
            <div class="narrative">${escapeHtml(narrative)}</div>
            ${inc.exact_words ? `<h3>Exact Wording</h3><p><em>"${escapeHtml(inc.exact_words)}"</em></p>` : ""}
            ${inc.impact_note ? `<h3>Impact</h3><p>${escapeHtml(inc.impact_note)}</p>` : ""}
            ${people.length > 0 ? `<p class="meta">Involved: ${people.map(escapeHtml).join(", ")}</p>` : ""}
            ${witnesses.length > 0 ? `<p class="meta">Witnesses: ${witnesses.map(escapeHtml).join(", ")}</p>` : ""}
            ${linkedEvidence.length > 0 ? `<p class="meta">Evidence: ${linkedEvidence.map((e) => escapeHtml(e.file_name)).join(", ")}</p>` : ""}
          </div>`;
          })
          .join("")}

        <div class="disclaimer">Project Chronicle provides documentation support only — not legal advice. Always consult a qualified employment solicitor or union representative before taking formal action.</div>
      </body></html>`;
    }

    return new Response(htmlContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}.html"`,
      },
    });
  } catch (e) {
    console.error("generate-export error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
