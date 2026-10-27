import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Encrypts API keys before they are stored (AES-256-GCM).
 * The key comes from HIREME_SECRET, else a random secret generated once into
 * .data/secret.key next to the local database. BETTER_AUTH_SECRET is still read so keys
 * saved by installs from before accounts were removed stay readable.
 */
let cachedKey: Buffer | undefined;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  let secret = process.env.HIREME_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    const dir = path.dirname(process.env.PGLITE_DIR ?? ".data/pglite");
    const file = path.join(dir, "secret.key");
    if (!existsSync(file)) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, randomBytes(32).toString("base64url"), { mode: 0o600 });
    }
    secret = readFileSync(file, "utf8").trim();
  }
  cachedKey = createHash("sha256").update(secret).digest();
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns null when the value can't be decrypted (e.g. the secret changed). */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
