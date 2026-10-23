import { aiErrorMessage } from "@/lib/ai/errors";
import { extractProfileFromCv } from "@/lib/ai/extract-profile";
import type { AiConfig } from "@/lib/ai/settings";
import type { CvImport } from "./cv-file";
import { detectSkills } from "./detect-skills";

/**
 * A profile draft from CV text: AI-extracted when a provider is set up, else (or when AI
 * fails) just the detected skills. Shared by the server action and the lite edition.
 */
export async function draftFromCv(fileName: string, text: string, config: AiConfig | null): Promise<CvImport> {
  let aiError: string | undefined;
  if (config) {
    try {
      const draft = await extractProfileFromCv(text, config);
      return { fileName, draft, usedAi: true };
    } catch (error) {
      console.error("CV extraction failed", error);
      aiError = aiErrorMessage(error, "AI extraction failed.");
      // Fall through to the free path so the import still helps.
    }
  }

  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { fileName, draft: { skills }, usedAi: false, aiError };
}
