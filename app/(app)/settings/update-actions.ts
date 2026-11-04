"use server";

import { z } from "zod";
import { askForUpdate, type AppUpdate } from "@/lib/desktop/updates";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";

const input = z.object({
  request: z.enum(["state", "check", "download", "later", "skip", "auto-check", "install"]),
  on: z.boolean().optional(),
});

/**
 * Desktop app updates (Settings → About & updates and the in-app notice): reads the state, checks,
 * downloads, installs, and remembers Later / Skip / automatic checks. Null outside the desktop app.
 */
export async function appUpdate(raw: z.input<typeof input>): Promise<Result<AppUpdate | null>> {
  await getCurrentUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That isn't an update request." };
  try {
    const { request, on } = parsed.data;
    return { ok: true, data: await askForUpdate(request, request === "auto-check" ? { on: Boolean(on) } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The desktop app couldn't do that." };
  }
}
