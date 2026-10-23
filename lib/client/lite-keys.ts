/*
 * Lite edition: API keys live in the browser database in the same columns the server
 * encrypts into. They can't be meaningfully encrypted in the browser (the app needs the
 * plain key to call the provider), so they're stored as "plain.<key>". The server's
 * decryptSecret() returns null for these, so a lite backup never hands it a key.
 */

const PREFIX = "plain.";

export function storeKey(plain: string): string {
  return PREFIX + plain;
}

export function readKey(stored: string | null | undefined): string | null {
  return stored?.startsWith(PREFIX) ? stored.slice(PREFIX.length) : null;
}
