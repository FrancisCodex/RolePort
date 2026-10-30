import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { InterviewBriefing, InterviewContext, InterviewReport, InterviewTurn, Panelist, PlannedQuestion } from "@/lib/interview/types";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

/* -------------------------------------------------------------------------- */
/* Users. session/account/verification are unused since accounts were removed; */
/* they stay so existing databases need no migration.                         */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const workSetup = pgEnum("work_setup", ["onsite", "hybrid", "remote"]);

export const employmentType = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "freelance",
  "internship",
]);

export const salaryPeriod = pgEnum("salary_period", ["hour", "day", "month", "year"]);

/** Gate verdicts from the evaluation framework: FAIL vetoes the job, FLAG needs the user's judgement. */
export const gateVerdict = pgEnum("gate_verdict", ["pass", "flag", "fail", "unverified"]);

export const applicationStatus = pgEnum("application_status", [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "offer_declined",
  "ghosted",
]);

export const documentKind = pgEnum("document_kind", ["uploaded_cv", "cv", "cover_letter", "follow_up", "application_answers"]);

/* -------------------------------------------------------------------------- */
/* Profile — the structured version of the reference repo's profile files     */
/* -------------------------------------------------------------------------- */

export type Skill = { name: string; level: "primary" | "secondary" | "learning"; years?: number };
export type Experience = {
  company: string;
  role: string;
  start: string;
  end?: string;
  location?: string;
  highlights: string[];
};
export type Education = { school: string; degree: string; field?: string; year?: string };
export type Language = { name: string; level: string };
export type CvContact = { email: string; phone: string; links: string[] };

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text("headline"),
  summary: text("summary"),
  /** e.g. "Quezon City", "Cebu City" */
  city: text("city"),
  /** e.g. "NCR", "Central Visayas" */
  region: text("region"),
  /** ISO 3166-1 alpha-2 code of the country the candidate lives in. */
  country: text("country").default("PH").notNull(),
  /** Other countries the candidate would move to or work for (codes). */
  targetCountries: text("target_countries").array().default(sql`'{}'::text[]`).notNull(),
  /** Countries the candidate can already work in without sponsorship, besides `country` (codes). */
  workAuthorizations: text("work_authorizations").array().default(sql`'{}'::text[]`).notNull(),
  yearsExperience: integer("years_experience"),
  desiredRoles: text("desired_roles").array().default(sql`'{}'::text[]`).notNull(),
  workSetups: workSetup("work_setups").array().default(sql`'{}'::work_setup[]`).notNull(),
  skills: jsonb("skills").$type<Skill[]>().default([]).notNull(),
  experience: jsonb("experience").$type<Experience[]>().default([]).notNull(),
  education: jsonb("education").$type<Education[]>().default([]).notNull(),
  languages: jsonb("languages").$type<Language[]>().default([]).notNull(),
  careerGoals: text("career_goals").array().default(sql`'{}'::text[]`).notNull(),
  dealBreakers: text("deal_breakers").array().default(sql`'{}'::text[]`).notNull(),
  /** Monthly expectation in `salaryCurrency`. */
  salaryMinMonthly: integer("salary_min_monthly"),
  salaryMaxMonthly: integer("salary_max_monthly"),
  salaryCurrency: text("salary_currency").default("PHP").notNull(),
  /** Plain text of the last imported CV, kept so drafts can quote the candidate accurately. */
  cvText: text("cv_text"),
  cvFileName: text("cv_file_name"),
  /** Writing-style notes used when drafting cover letters. */
  writingStyle: text("writing_style"),
  /** Contact lines printed at the top of generated CVs. */
  cvContact: jsonb("cv_contact").$type<CvContact>().default({ email: "", phone: "", links: [] }).notNull(),
  onboardingStep: integer("onboarding_step").default(0).notNull(),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActiveOn: date("last_active_on"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export const job = pgTable(
  "job",
  {
    id: id(),
    /** Dedup key across sources (normalized company + title + location). */
    jobKey: text("job_key").notNull().unique(),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    companyLogo: text("company_logo"),
    location: text("location"),
    city: text("city"),
    region: text("region"),
    workSetup: workSetup("work_setup"),
    employmentType: employmentType("employment_type"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency").default("PHP").notNull(),
    salaryPeriod: salaryPeriod("salary_period"),
    description: text("description"),
    skills: text("skills").array().default(sql`'{}'::text[]`).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    raw: jsonb("raw"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("job_source_source_id_idx").on(t.source, t.sourceId),
    index("job_posted_at_idx").on(t.postedAt),
  ],
);

/** Per-user fit evaluation (port of 04-job-evaluation.md: gates, then five dimensions). */
export const jobMatch = pgTable(
  "job_match",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    eligibilityGate: gateVerdict("eligibility_gate").notNull(),
    languageGate: gateVerdict("language_gate").notNull(),
    locationGate: gateVerdict("location_gate").notNull(),
    /** Each gate's reason, quoting the posting when it isn't a clean pass. */
    eligibilityNote: text("eligibility_note"),
    languageNote: text("language_note"),
    locationNote: text("location_note"),
    /** A profile deal-breaker the posting hits, quoted. Vetoes the job like a failed gate. */
    gateNote: text("gate_note"),
    skillsScore: integer("skills_score"),
    experienceScore: integer("experience_score"),
    cultureScore: integer("culture_score"),
    careerScore: integer("career_score"),
    overallScore: integer("overall_score"),
    strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
    gaps: jsonb("gaps").$type<string[]>().default([]).notNull(),
    summary: text("summary"),
    /** 1-2 sentences: apply, apply with caveats, or skip. */
    recommendation: text("recommendation"),
    /** Application deadline stated in the posting. */
    deadline: date("deadline"),
    /** The posting says it is closed or no longer accepting applications. */
    postingClosed: boolean("posting_closed").default(false).notNull(),
    model: text("model"),
    scoredAt: timestamp("scored_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("job_match_user_job_idx").on(t.userId, t.jobId),
    index("job_match_user_score_idx").on(t.userId, t.overallScore),
  ],
);

/* -------------------------------------------------------------------------- */
/* Pipeline (replaces job_search_tracker.csv + outcome.md)                    */
/* -------------------------------------------------------------------------- */

export const application = pgTable(
  "application",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    status: applicationStatus("status").default("saved").notNull(),
    channel: text("channel"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    followUpCount: integer("follow_up_count").default(0).notNull(),
    notes: text("notes"),
    /** When the user's interview for this application is scheduled, for the countdown and prep prompts. */
    interviewAt: timestamp("interview_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("application_user_job_idx").on(t.userId, t.jobId),
    index("application_user_status_idx").on(t.userId, t.status),
  ],
);

export const applicationEvent = pgTable(
  "application_event",
  {
    id: id(),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    status: applicationStatus("status").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("application_event_application_idx").on(t.applicationId)],
);

export const document = pgTable(
  "document",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: text("application_id").references(() => application.id, { onDelete: "cascade" }),
    kind: documentKind("kind").notNull(),
    title: text("title").notNull(),
    /** Structured content the PDF is rendered from. */
    content: jsonb("content"),
    fileUrl: text("file_url"),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (t) => [index("document_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Interview Coach — mock interviews, for an application or a role on its own */
/* -------------------------------------------------------------------------- */

export const interviewSession = pgTable(
  "interview_session",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The application practised for; null for a standalone practice. The context snapshot keeps the details. */
    applicationId: text("application_id").references(() => application.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetRole: text("target_role").notNull(),
    company: text("company"),
    /** InterviewFocus: screen | behavioral | role | posting. */
    focus: text("focus").notNull(),
    /** InterviewLength: quick | full. */
    length: text("length").notNull(),
    /** InterviewStyle: friendly | standard | tough | hell. */
    style: text("style").default("standard").notNull(),
    /** The weak spots a drill was built around, or null for a normal interview. */
    drill: jsonb("drill").$type<{ competencies: string[]; dimensions: string[] }>(),
    /** The two interviewers of a panel interview, or null for one interviewer. */
    panel: jsonb("panel").$type<Panelist[]>(),
    /** InterviewStatus: active | ended | done. */
    status: text("status").default("active").notNull(),
    context: jsonb("context").$type<InterviewContext>().notNull(),
    plan: jsonb("plan").$type<PlannedQuestion[]>().notNull(),
    turns: jsonb("turns").$type<InterviewTurn[]>().default([]).notNull(),
    report: jsonb("report").$type<InterviewReport>(),
    /** The pre-interview briefing, made on request before the first answer. */
    briefing: jsonb("briefing").$type<InterviewBriefing>(),
    ...timestamps,
  },
  (t) => [index("interview_session_user_idx").on(t.userId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Settings — bring-your-own keys and AI provider                             */
/* -------------------------------------------------------------------------- */

/**
 * Companies the user follows: searches also read these companies' own job feeds
 * (lib/jobs/sources/companies). `ats` is the hiring software, `slug` the company's name on it.
 */
export const followedCompany = pgTable(
  "followed_company",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ats: text("ats").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** The link the user pasted, to open the careers page from Settings. */
    careersUrl: text("careers_url"),
    ...timestamps,
  },
  (t) => [uniqueIndex("followed_company_user_board_idx").on(t.userId, t.ats, t.slug)],
);

export const aiProvider = pgEnum("ai_provider", ["anthropic", "openai_compatible"]);

/** Per-user settings. Secrets are encrypted with lib/secrets.ts and never sent to the browser. */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  aiProvider: aiProvider("ai_provider"),
  /** UI preset the provider settings came from (ollama, openai, openrouter, groq, custom). */
  aiPreset: text("ai_preset"),
  aiBaseUrl: text("ai_base_url"),
  aiModel: text("ai_model"),
  aiApiKeyEnc: text("ai_api_key_enc"),
  /** OpenAI-compatible reasoning_effort to send, or null to leave it to the provider. */
  aiReasoningEffort: text("ai_reasoning_effort"),
  rapidApiKeyEnc: text("rapid_api_key_enc"),
  /** Opted in to the JobSpy boards (LinkedIn, Indeed, …) on a self-hosted install. */
  jobspyEnabled: boolean("jobspy_enabled").default(false).notNull(),
  /** The user's own instructions for CV tailoring, or null to use the default (lib/ai/tailor-cv.ts). */
  cvPrompt: text("cv_prompt"),
  /** The user's own instructions for cover letters, or null to use the default (lib/ai/letter-prompt.ts). */
  coverLetterPrompt: text("cover_letter_prompt"),
  /** The user's own instructions for application question answers, or null to use the default (lib/ai/answer-prompt.ts). */
  answerPrompt: text("answer_prompt"),
  /** The user's own instructions for the mock interviewer, or null to use the default (lib/ai/interview-prompt.ts). */
  interviewPrompt: text("interview_prompt"),
  /** The user's own instructions for application emails and follow-ups, or null to use the default (lib/ai/email-prompt.ts). */
  emailPrompt: text("email_prompt"),
  /** When follow-ups come due, or null for the defaults (lib/outreach/rules.ts). */
  followUpRules: jsonb("follow_up_rules").$type<Partial<Record<string, number | null>>>(),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profile),
  sessions: many(session),
  accounts: many(account),
  matches: many(jobMatch),
  applications: many(application),
  documents: many(document),
}));

export const jobRelations = relations(job, ({ many }) => ({
  matches: many(jobMatch),
  applications: many(application),
}));

export const jobMatchRelations = relations(jobMatch, ({ one }) => ({
  user: one(user, { fields: [jobMatch.userId], references: [user.id] }),
  job: one(job, { fields: [jobMatch.jobId], references: [job.id] }),
}));

export const applicationRelations = relations(application, ({ one, many }) => ({
  user: one(user, { fields: [application.userId], references: [user.id] }),
  job: one(job, { fields: [application.jobId], references: [job.id] }),
  events: many(applicationEvent),
  documents: many(document),
}));

export const applicationEventRelations = relations(applicationEvent, ({ one }) => ({
  application: one(application, { fields: [applicationEvent.applicationId], references: [application.id] }),
}));

export const documentRelations = relations(document, ({ one }) => ({
  user: one(user, { fields: [document.userId], references: [user.id] }),
  application: one(application, { fields: [document.applicationId], references: [application.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const profileRelations = relations(profile, ({ one }) => ({
  user: one(user, { fields: [profile.userId], references: [user.id] }),
}));
