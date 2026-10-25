/*
 * Contact lines from CV text without AI: the email, phone number and profile links most CVs
 * put at the top. Used on every import, and to fill in what an AI extraction missed.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// A run of digits, spaces, dots, dashes and brackets, optionally after "+": checked for 10-15 digits below.
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/g;
const PROFILE_LINK =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:linkedin\.com\/in|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com\/@?|kaggle\.com|stackoverflow\.com\/users)\/?[\w%.-]+(?:\/[\w%.-]+)?/gi;
const URL = /https?:\/\/[^\s<>()"']+/gi;

const tidyLink = (link: string) => link.replace(/[.,;:)\]]+$/, "").replace(/\/+$/, "");

export function detectContact(text: string): { email: string; phone: string; links: string[] } {
  const email = text.match(EMAIL)?.[0] ?? "";

  const phone =
    (text.match(PHONE) ?? [])
      .map((p) => p.trim())
      // 10-15 digits: phone numbers, not dates ("2019 - 2022") or IDs; skip runs that are years back to back.
      .find((p) => {
        const digits = p.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15 && !/^(19|20)\d{2}\D+(19|20)\d{2}/.test(p);
      }) ?? "";

  const links: string[] = [];
  const emailDomain = email.split("@")[1]?.toLowerCase();
  for (const raw of [...(text.match(PROFILE_LINK) ?? []), ...(text.match(URL) ?? [])]) {
    const link = tidyLink(raw);
    const key = link.toLowerCase().replace(/^https?:\/\/(www\.)?/, "");
    if (emailDomain && key.startsWith(emailDomain)) continue;
    if (links.some((l) => l.toLowerCase().replace(/^https?:\/\/(www\.)?/, "") === key)) continue;
    links.push(link);
    if (links.length === 4) break;
  }

  return { email, phone, links };
}
