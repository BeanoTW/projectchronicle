import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
            content: `You are a formal documentation assistant for Project Chronicle. Your job is to create a structured case narrative from a series of workplace incident records.

RULES:
- Write in formal, neutral, third-person language suitable for workplace grievance documentation.
- Use the format "On [date], it is reported that..." for each incident reference.
- Identify recurring individuals and note the frequency of their involvement.
- Highlight patterns across incidents (same category, same people) using factual observations only.
- For impact: always use attributed language such as "The employee reports..." or "The record states..."
- Do NOT interpret intent or draw conclusions.
- Do NOT use speculative phrases like "this may indicate", "this suggests", or "this could reflect".
- Do NOT provide legal advice.
- Do NOT classify behaviour as unlawful.
- Do NOT use legal conclusions such as harassment, discrimination, victimisation, retaliation, or constructive dismissal.
- Keep the narrative factual and evidence-ready.
- Present facts, counts, and date ranges only.`
          },
          {
            role: "user",
            content: `Generate a structured case narrative from these incidents:\n\n${JSON.stringify(incidents, null, 2)}\n\nDetected patterns:\n${patterns?.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') || 'None'}`
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
                  title: { type: "string", description: "A formal title for the case summary" },
                  overview: { type: "string", description: "A 2-3 sentence factual overview of the case" },
                  chronology: { type: "string", description: "A chronological narrative of events using formal language" },
                  patterns_summary: { type: "string", description: "Factual summary of detected patterns and recurring individuals — counts and date ranges only" },
                  impact_summary: { type: "string", description: "Summary of reported impact using attributed language (The employee reports... / The record states...)" },
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
