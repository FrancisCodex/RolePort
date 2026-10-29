import { describe, expect, it } from "vitest";
import type { InterviewContext, InterviewTurn, PlannedQuestion } from "@/lib/interview/types";
import { reportProgress } from "@/lib/interview/types";
import {
  buildClaimsPrompt,
  buildRefinePrompt,
  claimsSchema,
  coachBudget,
  documentBlocks,
  LOCAL_BUDGET,
  refineSchema,
  reviewClaims,
  reviewRefined,
  wholeSentences,
} from "./interview";
import { toStrictJsonSchema } from "./structured";

const question: PlannedQuestion = {
  question: "Tell me about a project you led.",
  competency: "Ownership",
  intent: "Whether they drive work themselves.",
  strongSignals: ["their own actions", "a result"],
  redFlags: ["only team credit"],
};

const exchange: InterviewTurn[] = [
  { from: "interviewer", kind: "question", q: 0, text: question.question },
  { from: "candidate", kind: "answer", q: 0, text: "I led a team of 12 agents at Acme and cut wait times by 40%." },
] as InterviewTurn[];

const context: InterviewContext = {
  candidateName: "Sam",
  candidate: "Headline: Support lead\n".repeat(400),
  job: null,
  documents: [
    { label: "CV", text: "Team lead at Acme, managed 8 agents. ".repeat(500) },
    { label: "Cover letter", text: "I care about customers. ".repeat(500) },
  ],
};

describe("coach prompts for local models", () => {
  it("shares the document budget across documents", () => {
    const blocks = documentBlocks(context.documents, LOCAL_BUDGET);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) expect(b.length).toBeLessThan(LOCAL_BUDGET.docChars / 2 + 100);
  });

  it("keeps the claims and refine prompts small enough for an 8k context", () => {
    // ~4 characters a token: well under 8k tokens with room for the system prompt and reply.
    expect(buildClaimsPrompt({ question, exchange, context }, LOCAL_BUDGET).length).toBeLessThan(12_000);
    expect(buildRefinePrompt({ question, exchange, context, flags: [] }, LOCAL_BUDGET).length).toBeLessThan(6_000);
  });

  it("only trims for models on this machine", () => {
    expect(coachBudget({ provider: "openai_compatible", baseUrl: "http://localhost:11434/v1", apiKey: null, model: "qwen3:4b", reasoningEffort: "none", source: "settings" } as never)).toBe(LOCAL_BUDGET);
    expect(coachBudget({ provider: "anthropic", apiKey: "k", model: "claude-opus-5-5", source: "settings" })).not.toBe(LOCAL_BUDGET);
  });

  it("tells the stronger answer to leave out conflicts, not unbacked claims", () => {
    const prompt = buildRefinePrompt({
      question,
      exchange,
      context,
      flags: [
        { kind: "inflation", said: "a team of 12 agents", source: "CV", sourceQuote: "managed 8 agents", note: "Your CV says 8." },
        { kind: "unbacked", said: "cut wait times by 40%", source: null, sourceQuote: null, note: "Be ready to back it up." },
      ],
    });
    expect(prompt).toContain("a team of 12 agents");
    expect(prompt).not.toContain("cut wait times by 40%\":");
  });
});

describe("coach reviews", () => {
  it("keeps a conflict whose quotes are real, checked against the whole document", () => {
    const flags = reviewClaims(
      { claims: [{ kind: "inflation", said: "a team of 12 agents", source: "CV", sourceQuote: "managed 8 agents", note: "Your CV says 8." }] },
      { exchange, context },
    );
    expect(flags).toEqual([expect.objectContaining({ kind: "inflation", source: "CV" })]);
  });

  it("drops a claim the candidate never said", () => {
    expect(reviewClaims({ claims: [{ kind: "unbacked", said: "I won 3 awards", source: "", sourceQuote: "", note: "" }] }, { exchange, context })).toEqual([]);
  });

  it("warns about numbers in the stronger answer that nobody stated", () => {
    const refined = reviewRefined({ refinedAnswer: "I led 12 agents and cut wait times by 55%. We handled [how many] tickets.", notes: "Tighter." }, { exchange, context });
    expect(refined?.warnings.join(" ")).toContain("55");
    expect(refined?.warnings.join(" ")).toContain("placeholder");
  });
});

describe("reportProgress", () => {
  const plan = [question, question];
  const turns = [...exchange, { ...exchange[1], q: 1 }] as InterviewTurn[];
  const grade = { status: "graded", words: 10, followUps: 0, scores: { relevance: 3, structure: 3, evidence: 3, ownership: 3, impact: 3 }, summary: "", strengths: [], improvements: [] } as const;

  it("counts grade, check and stronger answer per question, plus the summary", () => {
    expect(reportProgress({ plan, turns, report: { results: [null, null], summary: null } } as never)).toEqual({ done: 0, total: 7 });
    expect(reportProgress({ plan, turns, report: { results: [{ ...grade, checked: true }, grade], summary: {} } } as never)).toEqual({ done: 4, total: 7 });
  });

  it("counts older sessions coached in one step as finished", () => {
    expect(reportProgress({ plan, turns, report: { results: [{ ...grade, coached: true }, { ...grade, coached: true }], summary: {} } } as never)).toEqual({
      done: 7,
      total: 7,
    });
  });
});

describe("length caps for local models", () => {
  it("writes limits into the JSON schema, by property name or by default", () => {
    const json = toStrictJsonSchema(refineSchema, { text: 400, list: 3, fields: { refinedAnswer: 1800 } }) as { properties: Record<string, { maxLength?: number }> };
    expect(json.properties.refinedAnswer.maxLength).toBe(1800);
    expect(json.properties.notes.maxLength).toBe(400);
    const grade = toStrictJsonSchema(claimsSchema, { text: 300, list: 3 }) as { properties: { claims: { maxItems: number; items: { properties: Record<string, { maxLength?: number }> } } } };
    expect(grade.properties.claims.maxItems).toBe(3);
    expect(grade.properties.claims.items.properties.said.maxLength).toBe(300);
    // Enums are already bounded.
    expect(grade.properties.claims.items.properties.kind.maxLength).toBeUndefined();
  });

  it("leaves the schema alone without limits", () => {
    expect(JSON.stringify(toStrictJsonSchema(refineSchema))).not.toMatch(/maxLength|maxItems/);
  });

  it("drops a sentence the cap cut off", () => {
    expect(wholeSentences("It went well. You were specific. This is")).toBe("It went well. You were specific.");
    expect(wholeSentences("Fill in [how many]")).toBe("Fill in [how many]");
    expect(wholeSentences("One unfinished thought")).toBe("One unfinished thought");
  });
});
