import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Consent page for Project Chronicle's MCP OAuth server.
// Supabase Auth redirects users here after they authorize an external client
// (e.g. ChatGPT, Claude) to connect to the app's MCP server. This page shows
// what is being granted and forwards approve/deny back to Supabase.

// The Supabase JS OAuth namespace is beta; declare a minimal local typing so
// this file compiles without loosening the generated client typings.
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function safeRelative(next: string | null | undefined): string {
  if (!next) return "/home";
  try {
    // Only allow same-origin relative paths.
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

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && !details && (
          <p className="text-sm text-muted-foreground">Loading authorization request…</p>
        )}

        {details && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">
                Connect {details.client?.name ?? "an application"} to Chronicle
              </h1>
              <p className="text-sm text-muted-foreground">
                {details.client?.name ?? "This application"} is requesting access to your
                Project Chronicle account. If you approve, it will be able to read and add
                records on your behalf using the same permissions you have when signed in.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm space-y-1">
              <p className="font-medium">This grants access to:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>List your incident records</li>
                <li>Read a specific incident record</li>
                <li>Create new incident records</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              You can revoke this connection at any time from your account settings. Only
              approve applications you trust.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Deny
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                Approve
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
