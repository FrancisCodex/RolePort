import { importCv as importCvOnServer, saveProfile as saveProfileOnServer } from "@/app/(app)/profile/actions";
import { isLite } from "@/lib/mode";

/*
 * Every write the UI makes, in one place: server actions in a self-hosted build,
 * functions on the browser database in the lite build. Same signatures either way.
 * The lite module (and PGlite with it) loads on first use.
 */

const lite = () => import("./lite-mutations");

export const saveProfile: typeof saveProfileOnServer = isLite ? async (input) => (await lite()).saveProfile(input) : saveProfileOnServer;

export const importCv: typeof importCvOnServer = isLite ? async (formData) => (await lite()).importCv(formData) : importCvOnServer;
