import { describe, expect, it } from "vitest";
import { agentPromptsOn } from "./access";
import * as prompts from "./agent-prompts";
import { MCP_TOOLS } from "./registry";

const job = { id: "job-1", title: "Data Analyst", company: "Acme" };
const app = { id: "app-1", role: "Data Analyst", company: "Acme" };
const interview = { id: "int-1", title: "Behavioral · Data Analyst" };

// One of every request the app offers, as a user would copy it.
const samples: Record<string, string> = {
  evaluateJobs: prompts.evaluateJobsPrompt([job, { ...job, id: "job-2", title: "BI Analyst" }]),
  evaluateJob: prompts.evaluateJobPrompt(job),
  prepareApplication: prompts.prepareApplicationPrompt(app),
  tailorCv: prompts.tailorCvPrompt(app),
  coverLetter: prompts.coverLetterPrompt(app),
  draftEmail: prompts.draftEmailPrompt(app, { id: "nudge_1", label: "First follow-up" }),
  mockInterviewForApplication: prompts.mockInterviewPrompt({ applicationId: "app-1", role: "Data Analyst", company: "Acme", focus: "posting", length: "quick", style: "tough", panel: true }),
  mockInterviewForRole: prompts.mockInterviewPrompt({ applicationId: null, role: "Data Analyst", company: "", focus: "behavioral", length: "full", style: "standard", panel: false, pastedPosting: true }),
  resumeInterview: prompts.resumeInterviewPrompt(interview),
  interviewReport: prompts.interviewReportPrompt(interview),
  importCv: prompts.importCvPrompt(),
  findJobs: prompts.findJobsPrompt(),
};

describe("when the app offers requests for the agent", () => {
  const on = (mcpAccess: "read" | "write" | null, mcpWriter: "roleport" | "agent" | null, hasAi: boolean) => agentPromptsOn({ mcpAccess, mcpWriter }, hasAi);

  it("needs the server on, with changes allowed", () => {
    expect(agentPromptsOn(null, false)).toBe(false);
    expect(on(null, null, false)).toBe(false);
    expect(on("read", null, false)).toBe(false);
    expect(on("write", null, false)).toBe(true);
  });

  it("follows who writes: the agent when RolePort has no AI, or always if Settings says so", () => {
    expect(on("write", null, true)).toBe(false);
    expect(on("write", "agent", true)).toBe(true);
    expect(on("write", "roleport", false)).toBe(false);
  });
});

describe("copy-paste requests for an AI agent", () => {
  it("only name tools the MCP server has", () => {
    const tools = new Set(MCP_TOOLS.map((t) => t.name));
    // Argument names and values the requests spell out, which aren't tools.
    const allowed = new Set(["job_id", "application_id", "interview_id", "job_description", "nudge_1"]);
    for (const [name, text] of Object.entries(samples)) {
      for (const word of text.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? []) {
        expect(tools.has(word) || allowed.has(word), `${name} mentions ${word}`).toBe(true);
      }
    }
  });

  it("carry the ids and choices of what they're for", () => {
    expect(samples.evaluateJobs).toContain("job_id job-1");
    expect(samples.evaluateJobs).toContain("job_id job-2");
    expect(samples.prepareApplication).toContain("application_id app-1");
    expect(samples.draftEmail).toContain("kind nudge_1");
    expect(samples.mockInterviewForApplication).toMatch(/application_id app-1[\s\S]*focus posting, length quick, style tough, panel true/);
    expect(samples.mockInterviewForRole).toContain('"Data Analyst"');
    expect(samples.mockInterviewForRole).toContain("job_description");
    expect(samples.resumeInterview).toContain("interview_id int-1");
  });
});
