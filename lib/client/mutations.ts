import * as applied from "@/app/(app)/applied/actions";
import * as coach from "@/app/(app)/coach/actions";
import * as letter from "@/app/(app)/applied/[id]/cover-letter/actions";
import * as questions from "@/app/(app)/applied/[id]/questions/actions";
import * as cv from "@/app/(app)/applied/[id]/cv/actions";
import * as jobs from "@/app/(app)/jobs/actions";
import * as profile from "@/app/(app)/profile/actions";
import * as settings from "@/app/(app)/settings/actions";
import { isLite } from "@/lib/mode";

/*
 * Every write the UI makes, in one place: server actions in a self-hosted build,
 * functions on the browser database in the lite build. Same signatures either way.
 * Components import from here, never from an actions.ts. The lite module (and
 * PGlite with it) loads on first use.
 */

const lite = () => import("./lite-mutations");

export const saveProfile: typeof profile.saveProfile = isLite ? async (...a) => (await lite()).saveProfile(...a) : profile.saveProfile;
export const importCv: typeof profile.importCv = isLite ? async (...a) => (await lite()).importCv(...a) : profile.importCv;
export const setOnboardingStep: typeof profile.setOnboardingStep = isLite
  ? async (...a) => (await lite()).setOnboardingStep(...a)
  : profile.setOnboardingStep;

export const toggleSavedJob: typeof jobs.toggleSavedJob = isLite ? async (...a) => (await lite()).toggleSavedJob(...a) : jobs.toggleSavedJob;
export const setApplicationStatus: typeof jobs.setApplicationStatus = isLite
  ? async (...a) => (await lite()).setApplicationStatus(...a)
  : jobs.setApplicationStatus;
export const evaluateJob: typeof jobs.evaluateJob = isLite ? async (jobId) => (await lite()).evaluateJob(jobId) : jobs.evaluateJob;

export const applyToJob: typeof applied.applyToJob = isLite ? async (...a) => (await lite()).applyToJob(...a) : applied.applyToJob;
export const saveApplicationNotes: typeof applied.saveApplicationNotes = isLite
  ? async (...a) => (await lite()).saveApplicationNotes(...a)
  : applied.saveApplicationNotes;
export const deleteApplication: typeof applied.deleteApplication = isLite
  ? async (...a) => (await lite()).deleteApplication(...a)
  : applied.deleteApplication;

export const saveAiSettings: typeof settings.saveAiSettings = isLite ? async (...a) => (await lite()).saveAiSettings(...a) : settings.saveAiSettings;
export const turnOffAi: typeof settings.turnOffAi = isLite ? async () => (await lite()).turnOffAi() : settings.turnOffAi;
export const testAiConnection: typeof settings.testAiConnection = isLite
  ? async (...a) => (await lite()).testAiConnection(...a)
  : settings.testAiConnection;
export const fetchModels: typeof settings.fetchModels = isLite ? async (...a) => (await lite()).fetchModels(...a) : settings.fetchModels;
export const saveRapidApiKey: typeof settings.saveRapidApiKey = isLite ? async (...a) => (await lite()).saveRapidApiKey(...a) : settings.saveRapidApiKey;
export const saveJobSpyEnabled: typeof settings.saveJobSpyEnabled = isLite
  ? async (...a) => (await lite()).saveJobSpyEnabled(...a)
  : settings.saveJobSpyEnabled;
export const exportData: typeof settings.exportData = isLite ? async () => (await lite()).exportData() : settings.exportData;
export const importData: typeof settings.importData = isLite ? async (...a) => (await lite()).importData(...a) : settings.importData;

export const tailorCv: typeof cv.tailorCv = isLite ? async (...a) => (await lite()).tailorCv(...a) : cv.tailorCv;
export const saveCv: typeof cv.saveCv = isLite ? async (...a) => (await lite()).saveCv(...a) : cv.saveCv;
export const discardCv: typeof cv.discardCv = isLite ? async (...a) => (await lite()).discardCv(...a) : cv.discardCv;
export const saveCvPrompt: typeof cv.saveCvPrompt = isLite ? async (...a) => (await lite()).saveCvPrompt(...a) : cv.saveCvPrompt;

export const draftLetter: typeof letter.draftLetter = isLite ? async (...a) => (await lite()).draftLetter(...a) : letter.draftLetter;
export const saveLetter: typeof letter.saveLetter = isLite ? async (...a) => (await lite()).saveLetter(...a) : letter.saveLetter;
export const discardLetter: typeof letter.discardLetter = isLite ? async (...a) => (await lite()).discardLetter(...a) : letter.discardLetter;
export const saveLetterPrompt: typeof letter.saveLetterPrompt = isLite
  ? async (...a) => (await lite()).saveLetterPrompt(...a)
  : letter.saveLetterPrompt;

export const saveQuestions: typeof questions.saveQuestions = isLite ? async (...a) => (await lite()).saveQuestions(...a) : questions.saveQuestions;
export const saveAnswerPrompt: typeof questions.saveAnswerPrompt = isLite
  ? async (...a) => (await lite()).saveAnswerPrompt(...a)
  : questions.saveAnswerPrompt;
export const answerApplicationQuestion: typeof questions.answerApplicationQuestion = isLite
  ? async (...a) => (await lite()).answerApplicationQuestion(...a)
  : questions.answerApplicationQuestion;

export const startInterview: typeof coach.startInterview = isLite ? async (...a) => (await lite()).startInterview(...a) : coach.startInterview;
export const answerInterviewQuestion: typeof coach.answerInterviewQuestion = isLite
  ? async (...a) => (await lite()).answerInterviewQuestion(...a)
  : coach.answerInterviewQuestion;
export const skipInterviewTurn: typeof coach.skipInterviewTurn = isLite ? async (...a) => (await lite()).skipInterviewTurn(...a) : coach.skipInterviewTurn;
export const endInterview: typeof coach.endInterview = isLite ? async (...a) => (await lite()).endInterview(...a) : coach.endInterview;
export const gradeInterview: typeof coach.gradeInterview = isLite ? async (...a) => (await lite()).gradeInterview(...a) : coach.gradeInterview;
export const redoQuestion: typeof coach.redoQuestion = isLite ? async (...a) => (await lite()).redoQuestion(...a) : coach.redoQuestion;
export const saveInterviewPrompt: typeof coach.saveInterviewPrompt = isLite
  ? async (...a) => (await lite()).saveInterviewPrompt(...a)
  : coach.saveInterviewPrompt;
export const setInterviewDate: typeof applied.setInterviewDate = isLite
  ? async (...a) => (await lite()).setInterviewDate(...a)
  : applied.setInterviewDate;
export const prepareBriefing: typeof coach.prepareBriefing = isLite ? async (...a) => (await lite()).prepareBriefing(...a) : coach.prepareBriefing;
export const deleteInterview: typeof coach.deleteInterview = isLite ? async (...a) => (await lite()).deleteInterview(...a) : coach.deleteInterview;
