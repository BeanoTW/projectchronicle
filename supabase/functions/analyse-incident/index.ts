import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { narrative, existingPatterns } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let patternContext = "";
    if (existingPatterns && existingPatterns.length > 0) {
      patternContext = `\n\nEXISTING PATTERNS FROM USER'S RECORDS:\n${existingPatterns.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}\n\nUse these to inform the potential_relevance field.`;
    }

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
            content: `You are a workplace incident structuring assistant for Project Chronicle. Your job is to extract factual structured data from a worker's narrative account of a workplace incident.

RULES:
- Extract facts only. Return null or blank where uncertain — do not guess.
- Do NOT provide legal advice.
- Do NOT classify behaviour as unlawful.
- Do NOT use legal conclusions such as: harassment, discrimination, victimisation, retaliation, constructive dismissal.
- Do NOT modify the original narrative in any way.
- Write the summary in formal, evidence-ready language using the format: "On [date], it is reported that..."
- The summary must be a precise factual restatement suitable for formal documentation. Avoid casual, emotional, or interpretive language.
- Do NOT use phrases like "the worker discovered", "the employee felt" — use neutral phrasing.
- For potential_relevance: identify possible workplace issue types (e.g. management conduct, communication failure, safety concern, procedural irregularity) and note if similar incidents exist. Use neutral tone — not legal advice.`
          },
          {
            role: "user",
            content: `Extract structured fields from this workplace incident account:\n\n"${narrative}"${patternContext}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_incident_fields",
              description: "Extract structured incident fields from a narrative account.",
              parameters: {
                type: "object",
                properties: {
                  incident_date: { type: "string", description: "Date of the incident in YYYY-MM-DD format, or null if not mentioned" },
                  incident_time: { type: "string", description: "Time of the incident in HH:MM format, or null if not mentioned" },
                  location: { type: "string", description: "Where the incident took place, or null if not mentioned" },
                  people_involved: { type: "array", items: { type: "string" }, description: "Names of people involved (including witnesses)" },
                  category: {
                    type: "string",
                    enum: ["Verbal Comment", "Written Communication", "Safety Concern", "Scheduling or Shift Change", "Disciplinary Meeting", "Management Conduct", "Pay or Payroll Issue", "Policy Application", "Workplace Meeting", "Other"],
                    description: "Best matching category"
                  },
                  severity: {
                    type: "string",
                    enum: ["Low", "Moderate", "Serious", "Critical"],
                    description: "Severity level based on impact described"
                  },
                  exact_words: { type: "string", description: "Any verbatim quotes found in the narrative, or null" },
                  summary: { type: "string", description: "A formal, evidence-ready factual summary of the incident (2-3 sentences max). Use precise language suitable for documentation." },
                  title: { type: "string", description: "A short descriptive title for the incident (under 10 words)" },
                  potential_relevance: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 neutral observations about possible workplace issue types this may relate to, and pattern relevance if similar incidents exist. Not legal advice."
                  }
                },
                required: ["people_involved", "summary", "title", "potential_relevance"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_incident_fields" } },
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
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
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
    console.error("analyse-incident error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
