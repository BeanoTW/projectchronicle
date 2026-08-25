// Edge function: securely delete the authenticated user's account and all
// of their cloud-stored data. Requires a valid JWT in the Authorization header.
// Uses the service role key to perform the auth.users deletion (which the
// client SDK cannot do).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function removeOwnerFolder(admin: ReturnType<typeof createClient>, bucket: string, ownerId: string) {
  const queue = [ownerId];
  const paths: string[] = [];
  while (queue.length > 0) {
    const prefix = queue.shift()!;
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Storage folders have no object id/metadata; recurse into them.
      if (!item.id && !item.metadata) queue.push(path);
      else paths.push(path);
    }
  }
  for (let i = 0; i < paths.length; i += 1000) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 1000));
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // Cloud media must be removed before auth deletion because storage objects
    // do not cascade through the canonical table foreign keys.
    for (const bucket of ["evidence", "canonical-media"]) {
      try { await removeOwnerFolder(admin, bucket, userId); }
      catch (e) { console.warn(`[delete-account] ${bucket} cleanup warning`, e); }
    }

    // Legacy rows do not all cascade from auth.users, so retain the explicit sweep.
    const tables = ["edit_history", "follow_up_notes", "evidence_files", "incidents"];
    for (const t of tables) {
      const { error } = await admin.from(t).delete().eq("user_id", userId);
      if (error) return new Response(JSON.stringify({ error: `Failed to delete ${t}: ${error.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // canonical_records / canonical_children are owner FK cascades from auth.users.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return new Response(JSON.stringify({ error: `Failed to delete account: ${delErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[delete-account] unexpected", e);
    return new Response(JSON.stringify({ error: "Unable to delete your account right now. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
