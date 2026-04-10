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
            content: `You are a workplace incident structuring assistant for Project Chronicle. Your job is to extract factual structured data from a worker's account of a workplace incident.

RULES:
- Extract facts only. Return null or blank where uncertain — do not guess.
- Do NOT provide legal advice.
- Do NOT classify behaviour as unlawful.
- Do NOT use legal conclusions such as: harassment, discrimination, victimisation, retaliation, constructive dismissal.
- Do NOT modify the original narrative in any way.
- Write the summary as a lightly structured version of the user's own words. Stay close to their original phrasing.
- PREFER slight reordering of the user's words over rewriting them. Keep their vocabulary intact.
- Keep exact phrases and key wording from the original account — especially anything in quotes or with strong phrasing.
- Do NOT replace first-person ("me", "my", "I") with third-person ("the employee") unless absolutely necessary for clarity.
- Use direct, natural phrasing: "On [date], [what happened]." or "During [context], [what happened]."
- Do NOT use distancing phrases like "it is reported that", "the employee reports", "the employee states that", "the worker discovered", "continued to question you after".
- The summary should feel like cleaned-up notes written by the person themselves, not a formal report or retelling from a third party.
- Keep summaries concise and factual. Avoid emotional, interpretive, or overly polished language.
- For the title: make it short, specific, and include exact wording if available. Write it the way a person would describe the incident in conversation.
  GOOD titles: "Manager A said I was 'too slow' in front of customers", "Colleague made comments about me in car"
  BAD titles: "Interaction with Manager A regarding work pace", "Report of colleague conduct and verbal comments"
  Avoid vague words like "interaction", "regarding", "report of", "incident involving".
- For potential_relevance: identify possible issue types (e.g. communication issue, working conditions, pay concern) and note if similar incidents exist. State facts only — no interpretation.

PRIMARY CATEGORY CLASSIFICATION:
Assign exactly one primary category based on the dominant observable behaviour described. Categories describe what happened — not interpretation, intent, or legality.

Categories and definitions:
- Communication → Spoken or written words directed at or around the user. Includes: remarks, instructions, conversations, messages, emails. Excludes: physical actions, process outcomes.
- Action / Change → Assignment, removal, or distribution of work tasks, responsibilities, or conditions. Includes: shifts, duties, role changes, access changes. Excludes: general communication about work.
- Process Event → Application or execution of a formal or informal process. Includes: meetings, hearings, investigations, outcomes, appeals. Excludes: general managerial responses outside a process.
- Pay / Benefits → Changes or issues relating to pay, benefits, or financial entitlements. Includes: pay, bonuses, holiday, sick pay, expenses. Excludes: general working conditions.
- Working Conditions → Conditions affecting safety, environment, or operational functioning. Includes: risks, equipment, staffing, workload, breaks, environment. Excludes: interpersonal behaviour.
- Observed Behaviour → Observable behaviour or conduct directed at or around the user. Includes: tone, exclusion, ignoring, gestures, unequal treatment. Excludes: anything spoken or written as the primary behaviour.
- Record Issued → A formal record, notice, or document issued to the user. Includes: warnings, written records, policy documents, contracts. Excludes: informal communication.
- Other → Used only when no category reasonably applies.

SUBTYPE CLASSIFICATION:
After assigning the primary category, assign exactly one subtype from the valid set for that category:
- Communication: Verbal statement, Written message, Email, Public statement, Internal communication, Instruction given, Unclassified
- Action / Change: Shift removed, Shift added, Role changed, Duties reassigned, Access revoked, Access granted, Location changed, Schedule altered, Unclassified
- Process Event: Meeting held, Meeting scheduled, Investigation started, Investigation ongoing, Outcome issued, Appeal submitted, Appeal outcome issued, Formal notice given, Unclassified
- Pay / Benefits: Pay change, Pay withheld, Bonus / commission change, Holiday / leave issue, Sick pay issue, Expenses issue, Unclassified
- Working Conditions: Unsafe condition, Equipment issue, Staffing level issue, Workload level change, Break / rest issue, Temperature / environment issue, Unclassified
- Observed Behaviour: Tone / manner, Ignored / no response, Exclusion from activity, Unequal treatment (observed difference), Repeated behaviour, Physical gesture / conduct, Unclassified
- Record Issued: Warning issued, Written record created, Policy document provided, Contract / terms issued, Notes recorded, Unclassified
- Other: Unclassified

CLASSIFICATION RULES:
- Classify based on the primary behaviour described, not every behaviour mentioned.
- Where multiple categories seem relevant, assign the most behaviourally specific one.
- If a valid subtype cannot be determined, assign "Unclassified" within the selected category.
- Use "Other" only when no trigger fits. If any trigger exists, assign the best match.

PRIORITY ORDER (tie-breaker when multiple categories equally match):
1. Record Issued
2. Process Event
3. Action / Change
4. Pay / Benefits
5. Working Conditions
6. Communication
7. Observed Behaviour
8. Other`
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
                  people_involved: { type: "array", items: { type: "string" }, description: "Names of people involved" },
                  category: {
                    type: "string",
                    enum: ["Communication", "Action / Change", "Process Event", "Pay / Benefits", "Working Conditions", "Observed Behaviour", "Record Issued", "Other"],
                    description: "Primary category based on dominant observable behaviour."
                  },
                  subtype: {
                    type: "string",
                    description: "Subtype within the assigned primary category. Must be one of the valid subtypes for the chosen category."
                  },
                  severity: {
                    type: "string",
                    enum: ["Low", "Moderate", "Serious", "Critical"],
                    description: "Severity level based on impact described"
                  },
                  exact_words: { type: "string", description: "Any verbatim quotes found in the narrative, or null" },
                  summary: { type: "string", description: "A lightly structured version of the user's account using their own words. Prefer reordering over rewriting. Keep key phrases intact. 2-3 sentences max." },
                  title: { type: "string", description: "A short, specific title (under 12 words). Include exact wording in quotes if available. Avoid vague words like 'interaction', 'regarding', 'report of'." },
                  potential_relevance: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 neutral factual observations about possible workplace issue types this relates to. Not legal advice."
                  }
                },
                required: ["people_involved", "summary", "title", "potential_relevance", "category", "subtype"],
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
