import "server-only";
import type { z } from "zod";
import { getAiConfig } from "./config";
import { AiUnavailableError, generateStructured as generateWith, type StructuredRequest } from "./structured";

export { AiUnavailableError, listModels } from "./structured";

/**
 * One model call that returns JSON validated against `schema`, on the current user's provider
 * unless `config` overrides it (used by "Test connection"). The calls themselves live in
 * ./structured.ts, shared with the lite edition.
 */
export async function generateStructured<Schema extends z.ZodType>(
  req: Omit<StructuredRequest<Schema>, "config"> & { config?: StructuredRequest<Schema>["config"] },
): Promise<z.infer<Schema>> {
  const config = req.config ?? (await getAiConfig());
  if (!config) throw new AiUnavailableError();
  return generateWith({ ...req, config });
}
