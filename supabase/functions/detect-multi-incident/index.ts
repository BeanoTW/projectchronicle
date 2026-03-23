import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { narrative } = await req.json();
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
            content: `You are a workplace incident structuring assistant. Your job is to detect whether a narrative describes MULTIPLE separate incidents and, if so, identify highlight phrases and draft splits.

RULES:
- An "incident" is a distinct event at a specific time/place. Recurring patterns described generally are ONE incident unless specific separate occasions are described.
- Only flag as multiple if there are clearly 2+ distinct events with different times, dates, or contexts.
- Be conservative — when in doubt, say it's a single incident.
- Do NOT provide legal advice or legal conclusions.
- Keep the user's original wording intact in drafts.
- Highlight phrases are exact substrings from the narrative that signal separate events (dates, transition words, repeated actions).`
          },
          {
            role: "user",
            content: `Analyse this narrative for multiple incidents:\n\n"${narrative}"`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "detect_multi_incident",
              description: "Detect whether narrative contains multiple incidents and return highlights and drafts.",
              parameters: {
                type: "object",
                properties: {
                  is_multi: {
                    type: "boolean",
                    description: "True if the narrative clearly describes 2+ separate incidents"
                  },
                  confidence: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Confidence that there are multiple incidents"
                  },
                  highlight_phrases: {
                    type: "array",
                    items: { type: "string" },
                    description: "Exact substrings from the narrative to highlight (dates, transition words, repeated action phrases). Must be verbatim from the text."
                  },
                  suggested_count: {
                    type: "number",
                    description: "Number of incidents detected (1 if single)"
                  },
                  drafts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short specific title for this incident" },
                        narrative: { type: "string", description: "The portion of text relevant to this incident, using the user's own words" },
                        incident_date: { type: "string", description: "Date in YYYY-MM-DD if mentioned, or null" },
                        incident_time: { type: "string", description: "Time in HH:MM if mentioned, or null" }
                      },
                      required: ["title", "narrative"]
                    },
                    description: "Draft incidents if is_multi is true. Empty array if single."
                  }
                },
                required: ["is_multi", "confidence", "highlight_phrases", "suggested_count", "drafts"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "detect_multi_incident" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
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
      return new Response(JSON.stringify({ error: "Detection failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ is_multi: false, confidence: "low", highlight_phrases: [], suggested_count: 1, drafts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-multi-incident error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
