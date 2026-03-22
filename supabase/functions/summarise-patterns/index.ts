import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { patterns } = await req.json();
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
            content: `You are a workplace incident pattern summariser for Project Chronicle.

RULES:
- Summarise ONLY the patterns provided. Do not invent patterns.
- Use strictly observational and factual language.
- State counts, frequencies, date ranges, and recorded facts only.
- Do NOT interpret, speculate, or draw conclusions.
- Do NOT use phrases like "this may indicate", "this suggests", "this could reflect", "appears to show intent".
- Do NOT provide legal advice.
- Do NOT classify behaviour as unlawful.
- Do NOT suggest the user has a legal claim.
- Do NOT use terms like harassment, discrimination, victimisation, retaliation, or constructive dismissal.
- Each summary should be one clear, factual sentence.
- Return 2-4 observations.

EXAMPLE STYLE:
- "Mark Taylor appears in 5 recorded incidents between January and March 2026."
- "Management Conduct is the most frequently recorded category (7 incidents)."
- "3 incidents were recorded within a 7-day period."
- "4 incidents have no linked evidence files."`
          },
          {
            role: "user",
            content: `Summarise these detected patterns from a worker's incident records using factual, observational language only:\n\n${patterns.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_summaries",
              description: "Return factual, observational pattern summaries.",
              parameters: {
                type: "object",
                properties: {
                  summaries: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of factual, observational pattern statements"
                  }
                },
                required: ["summaries"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_summaries" } },
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
      return new Response(JSON.stringify({ error: "AI summary failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ summaries: patterns }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarise-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
