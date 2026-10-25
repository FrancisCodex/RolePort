import { z } from "zod";

export const WORK_SETUPS = ["onsite", "hybrid", "remote"] as const;
export const SKILL_LEVELS = ["primary", "secondary", "learning"] as const;

/** The editable profile, shared by the form, the server action and the AI extractor. */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Add your name").max(120),
  headline: z.string().trim().max(160).nullable(),
  /** Contact lines for CVs and applications. Empty when not given. */
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Check your email address"),
  phone: z.string().trim().max(60),
  links: z.array(z.string().trim().min(1).max(200)).max(4, "Keep it to 4 links"),
  summary: z.string().trim().max(2000).nullable(),
  city: z.string().trim().max(80).nullable(),
  region: z.string().trim().max(80).nullable(),
  country: z.string().trim().length(2, "Pick the country you live in").toUpperCase(),
  targetCountries: z.array(z.string().trim().length(2).toUpperCase()).max(20),
  workAuthorizations: z.array(z.string().trim().length(2).toUpperCase()).max(20),
  yearsExperience: z.number().int().min(0).max(60).nullable(),
  desiredRoles: z.array(z.string().trim().min(1).max(80)).max(10),
  workSetups: z.array(z.enum(WORK_SETUPS)),
  skills: z
    .array(z.object({ name: z.string().trim().min(1).max(60), level: z.enum(SKILL_LEVELS) }))
    .max(60),
  experience: z
    .array(
      z.object({
        company: z.string().trim().min(1).max(120),
        role: z.string().trim().min(1).max(120),
        start: z.string().trim().max(20),
        end: z.string().trim().max(20).nullable(),
        location: z.string().trim().max(120).nullable(),
        highlights: z.array(z.string().trim().min(1).max(400)).max(10),
      }),
    )
    .max(20),
  education: z
    .array(
      z.object({
        school: z.string().trim().min(1).max(160),
        degree: z.string().trim().min(1).max(160),
        field: z.string().trim().max(120).nullable(),
        year: z.string().trim().max(20).nullable(),
      }),
    )
    .max(10),
  languages: z.array(z.object({ name: z.string().trim().min(1).max(40), level: z.string().trim().max(40) })).max(10),
  careerGoals: z.array(z.string().trim().min(1).max(200)).max(8),
  dealBreakers: z.array(z.string().trim().min(1).max(200)).max(8),
  salaryMinMonthly: z.number().int().min(0).max(10_000_000).nullable(),
  salaryMaxMonthly: z.number().int().min(0).max(1_000_000_000).nullable(),
  salaryCurrency: z.string().trim().length(3).toUpperCase(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const emptyProfile: ProfileInput = {
  name: "",
  headline: null,
  email: "",
  phone: "",
  links: [],
  summary: null,
  city: null,
  region: null,
  country: "PH",
  targetCountries: [],
  workAuthorizations: [],
  yearsExperience: null,
  desiredRoles: [],
  workSetups: [],
  skills: [],
  experience: [],
  education: [],
  languages: [],
  careerGoals: [],
  dealBreakers: [],
  salaryMinMonthly: null,
  salaryMaxMonthly: null,
  salaryCurrency: "PHP",
};
