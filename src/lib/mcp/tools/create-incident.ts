declare const process: { env: Record<string, string | undefined> };

import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_incident",
  title: "Create incident record",
  description:
    "Create a new workplace incident record for the signed-in user. The user's own words are preserved verbatim in raw_narrative — do not paraphrase. Optional structured fields (title, incident_date, location, people_involved, category) may be supplied when clearly stated by the user; leave them blank otherwise.",
  inputSchema: {
    raw_narrative: z
      .string()
      .trim()
      .min(1)
      .describe("The user's account of the incident, preserved verbatim in their own words."),
    title: z.string().trim().min(1).max(200).optional().describe("Short title for the record."),
    incident_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Date the incident occurred, YYYY-MM-DD."),
    location: z.string().trim().optional().describe("Where the incident took place."),
    people_involved: z
      .array(z.string().trim().min(1))
      .optional()
      .describe("Names of people involved."),
    category: z.string().trim().optional().describe("Primary category, if clearly stated."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const row = {
      user_id: ctx.getUserId(),
      raw_narrative: input.raw_narrative,
      title: input.title ?? null,
      incident_date: input.incident_date ?? null,
      location: input.location ?? null,
      people_involved: input.people_involved ?? null,
      category: input.category ?? null,
      record_method: "mcp",
      status: "draft",
    };
    const { data, error } = await supabaseForUser(ctx)
      .from("incidents")
      .insert(row)
      .select("id, title, incident_date, category, created_at")
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [
        { type: "text", text: `Incident recorded (id: ${data.id}). Review it in Chronicle before finalising.` },
      ],
      structuredContent: { incident: data },
    };
  },
});
