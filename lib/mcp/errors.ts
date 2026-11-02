import { ToolError } from "./tool";

export const AI_NOT_SET_UP =
  "No AI is set up in RolePort. The user can choose a provider (their own API key, or a local model with Ollama) in RolePort's Settings → AI provider.";

export function notFound(what: "job" | "application", id: string): ToolError {
  return new ToolError(
    what === "job"
      ? `No job with id ${id}. Use an id from search_jobs, get_job or list_applications.`
      : `No application with id ${id}. Use an id from list_applications or apply_to_job.`,
  );
}
