import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthShell from "@/chronicle/shared/AuthShell";
import { supabase } from "@/integrations/supabase/client";

// Consent page for Project Chronicle's MCP OAuth server.
// Supabase Auth redirects users here after they authorize an external client
// (e.g. ChatGPT, Claude) to connect to the app's MCP server.

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function safeRelative(next: string | null | undefined): string {
  if (!next) return "/home";
  try {
    if (next.startsWith("/") && !next.startsWith("//")) return next;
  } catch {}
  return "/home";
}

export default function OAuthConsentScreen() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization request.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = safeRelative(window.location.pathname + window.location.search);
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The authorization server did not return a redirect.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an application";
  const title = error
    ? "Connection could not be opened"
    : details
      ? `Connect ${clientName} to Chronicle`
      : "Preparing secure connection";
  const lede = error
    ? "Chronicle has not shared any record data."
    : details
      ? `${clientName} is asking for permission to work with your Chronicle.`
      : "Checking the authorization request.";

  return (
    <AuthShell
      title={title}
      lede={lede}
      footer="Only approve a connection you recognise and trust."
    >
      {error && (
        <div className="proto-form">
          <p className="proto-formerror" role="alert">{error}</p>
          <Link className="proto-btn text-center" to="/">Return to Chronicle</Link>
        </div>
      )}

      {!error && !details && (
        <div className="rounded-xl border border-border bg-card/70 px-4 py-4" role="status">
          <p className="text-[13px] text-muted-foreground">Loading authorization request…</p>
        </div>
      )}

      {!error && details && (
        <div className="proto-form">
          <section className="rounded-xl border border-border bg-card/70 px-4 py-4" aria-labelledby="connection-access">
            <p id="connection-access" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Access requested
            </p>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground/80">
              <li>List your incident records</li>
              <li>Read a specific incident record</li>
              <li>Create new incident records</li>
            </ul>
          </section>

          <p className="proto-help">
            If you approve, {clientName} can act using the same record permissions you have when signed in.
            You can revoke the connection later from Settings.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="proto-btn"
              disabled={busy}
              onClick={() => decide(false)}
            >
              Deny
            </button>
            <button
              type="button"
              className="proto-btn"
              data-variant="primary"
              disabled={busy}
              onClick={() => decide(true)}
            >
              {busy ? "Working…" : "Approve"}
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
