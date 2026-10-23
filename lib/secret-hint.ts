/** "sk-…4f2a" style hint so the UI can show which key is saved without revealing it. */
export function maskSecret(plain: string | null): string | null {
  if (!plain) return null;
  return plain.length <= 8 ? "••••" : `${plain.slice(0, 3)}…${plain.slice(-4)}`;
}
