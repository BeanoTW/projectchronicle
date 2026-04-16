import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function authenticateRequest(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.claims.sub as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  try {
    const { incidents, patterns } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a documentation assistant for Project Chronicle. Create a structured narrative from workplace incident records.

RULES:
- Write in clear, neutral language. Keep it readable and human — not overly formal or legalistic.
- Use direct phrasing: "On [date], [what happened]." Not "it is reported that" or "the employee states".
- Stay close to the original wording from incident records. Do not over-polish or rewrite extensively.
- Identify recurring individuals and note the frequency of their involvement.
- Highlight patterns across incidents using factual observations only (counts, dates, categories).
- For impact: describe what is documented in the records directly. Do not add interpretation.
- Do NOT interpret intent or draw conclusions.
- Do NOT use speculative phrases like "this may indicate", "this suggests", or "this could reflect".
- Do NOT provide legal advice or classify behaviour as unlawful.
- Present facts, counts, and date ranges only.`
          },
          {
            role: "user",
            content: `Generate a structured narrative from these incidents:\n\n${JSON.stringify(incidents, null, 2)}\n\nDetected patterns:\n${patterns?.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') || 'None'}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_case_narrative",
              description: "Return a structured case narrative.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "A clear title for the summary" },
                  overview: { type: "string", description: "A 2-3 sentence factual overview" },
                  chronology: { type: "string", description: "A chronological narrative of events in clear, direct language" },
                  patterns_summary: { type: "string", description: "Factual summary of recurring themes — counts and date ranges only" },
                  impact_summary: { type: "string", description: "Summary of how events affected the person, based on what they recorded" },
                  key_individuals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        involvement_count: { type: "number" },
                        context: { type: "string" }
                      },
                      required: ["name", "involvement_count", "context"]
                    },
                    description: "Recurring individuals and their involvement"
                  }
                },
                required: ["title", "overview", "chronology", "patterns_summary", "impact_summary", "key_individuals"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_case_narrative" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI case narrative failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-case-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
