import type { McpTool } from "./tool";
import { applyToJob, followUpsDue, getApplication, listApplications, setApplicationStatus, setInterviewDate, setNotes } from "./tools/applications";
import { draftCoverLetter, draftEmail, markEmailSent, tailorCv } from "./tools/documents";
import {
  answerInterviewTool,
  endInterviewTool,
  getInterviewReport,
  getMockInterview,
  listMockInterviews,
  skipInterviewQuestionTool,
  startMockInterview,
} from "./tools/interview";
import { addJob, checkJobOpen, evaluateJob, getJob, listEvaluatedJobs, saveJob, searchJobs, unsaveJob } from "./tools/jobs";
import { getProfile, listFollowedCompanies } from "./tools/profile";
import { importCv } from "./tools/profile-import";

/**
 * Every tool the MCP server offers, in the order agents list them. A new tool is one entry here;
 * lib/mcp/mcp.test.ts checks each has a name, a description and a schema.
 */
export const MCP_TOOLS: McpTool[] = [
  getProfile,
  searchJobs,
  getJob,
  listEvaluatedJobs,
  listApplications,
  getApplication,
  followUpsDue,
  listFollowedCompanies,
  listMockInterviews,
  getMockInterview,
  saveJob,
  unsaveJob,
  addJob,
  checkJobOpen,
  evaluateJob,
  applyToJob,
  setApplicationStatus,
  setNotes,
  setInterviewDate,
  tailorCv,
  draftCoverLetter,
  draftEmail,
  markEmailSent,
  importCv,
  startMockInterview,
  answerInterviewTool,
  skipInterviewQuestionTool,
  endInterviewTool,
  getInterviewReport,
];
