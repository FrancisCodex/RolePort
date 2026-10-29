import type { JobSource } from "../types";
import { arbeitnowSource } from "./arbeitnow";
import { COMPANY_SOURCES } from "./companies";
import { freehireSource } from "./freehire";
import { himalayasSource } from "./himalayas";
import { jobicySource } from "./jobicy";
import { jobSpySources } from "./jobspy";
import { jsearchSource } from "./jsearch";
import { platsbankenSource } from "./platsbanken";
import { remoteOkSource } from "./remoteok";
import { remotiveSource } from "./remotive";

/*
 * Every job source, in one list. Adding a source is a new file in this folder plus one line here
 * (docs/ADDING_A_JOB_SOURCE.md); a test fails if a source file isn't listed.
 *
 * Order matters: when two sources carry the same posting, the earlier one is shown and links to the
 * others. Straight from the employer first, then the big aggregators, then official boards, then
 * the remote feeds.
 */
export const JOB_SOURCES: JobSource[] = [
  ...COMPANY_SOURCES,
  jsearchSource,
  ...jobSpySources,
  freehireSource,
  platsbankenSource,
  arbeitnowSource,
  jobicySource,
  remotiveSource,
  himalayasSource,
  remoteOkSource,
];

/**
 * What the hosted lite edition searches from its server: never the JobSpy boards, whose
 * terms forbid automated access (lite users connect JobSpy on their own computer instead).
 */
export const HOSTED_SOURCES = JOB_SOURCES.filter((s) => s.kind !== "opt-in");
