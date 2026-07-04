import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listIncidentsTool from "./tools/list-incidents";
import getIncidentTool from "./tools/get-incident";
import createIncidentTool from "./tools/create-incident";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "project-chronicle-mcp",
  title: "Project Chronicle",
  version: "0.1.0",
  instructions:
    "Tools for Project Chronicle — a structured, chronological workplace record. Use `list_incidents` to browse the signed-in user's recorded incidents, `get_incident` to read a specific record in full, and `create_incident` to add a new record. Preserve the user's own words verbatim in raw_narrative; never paraphrase or add legal interpretation.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listIncidentsTool, getIncidentTool, createIncidentTool],
});
