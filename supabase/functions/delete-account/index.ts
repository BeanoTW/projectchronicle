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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate the caller's JWT by reading their user from the anon-key client
    // bound to the request's Authorization header.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error("[delete-account] invalid session", userErr?.message);
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.info("[delete-account] deleting", { userId });

    // Service-role client for privileged operations.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Remove storage objects from the evidence bucket scoped to this user.
    try {
      const { data: files } = await admin.storage
        .from("evidence")
        .list(userId, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await admin.storage.from("evidence").remove(paths);
      }
    } catch (e) {
      console.warn("[delete-account] storage cleanup warning", e);
    }

    // 2. Delete user-owned rows. RLS would also restrict this, but using the
    //    service role guarantees a clean sweep.
    const tables = ["edit_history", "follow_up_notes", "evidence_files", "incidents"];
    for (const t of tables) {
      const { error } = await admin.from(t).delete().eq("user_id", userId);
      if (error) {
        console.error(`[delete-account] failed to clear ${t}`, error.message);
        return new Response(
          JSON.stringify({ error: `Failed to delete ${t}: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 3. Finally delete the auth user. This invalidates all their sessions.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[delete-account] auth delete failed", delErr.message);
      return new Response(
        JSON.stringify({ error: `Failed to delete account: ${delErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.info("[delete-account] success", { userId });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-account] unexpected", e);
    return new Response(
      JSON.stringify({ error: "Unable to delete your account right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
