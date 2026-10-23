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

export const toggleSavedJob: typeof jobs.toggleSavedJob = isLite ? async (...a) => (await lite()).toggleSavedJob(...a) : jobs.toggleSavedJob;
export const setApplicationStatus: typeof jobs.setApplicationStatus = isLite
  ? async (...a) => (await lite()).setApplicationStatus(...a)
  : jobs.setApplicationStatus;
export const evaluateJob: typeof jobs.evaluateJob = isLite ? async () => (await lite()).evaluateJob() : jobs.evaluateJob;

export const saveAiSettings: typeof settings.saveAiSettings = isLite ? async (...a) => (await lite()).saveAiSettings(...a) : settings.saveAiSettings;
export const turnOffAi: typeof settings.turnOffAi = isLite ? async () => (await lite()).turnOffAi() : settings.turnOffAi;
export const testAiConnection: typeof settings.testAiConnection = isLite ? async () => (await lite()).testAiConnection() : settings.testAiConnection;
export const fetchModels: typeof settings.fetchModels = isLite ? async () => (await lite()).fetchModels() : settings.fetchModels;
export const saveRapidApiKey: typeof settings.saveRapidApiKey = isLite ? async (...a) => (await lite()).saveRapidApiKey(...a) : settings.saveRapidApiKey;
export const saveJobSpyEnabled: typeof settings.saveJobSpyEnabled = isLite ? async () => (await lite()).saveJobSpyEnabled() : settings.saveJobSpyEnabled;
