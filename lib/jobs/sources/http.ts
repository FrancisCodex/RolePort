/**
 * The one way job sources call a board: HTTPS only, to hosts the source names up front, with a
 * timeout, a few retries when the board is busy, and a hard cap on how many pages one search reads.
 * See docs/ADDING_A_JOB_SOURCE.md.
 */

export const USER_AGENT = "RolePort/0.1 (job search; +https://github.com/FrancisCodex/RolePort)";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const MAX_REDIRECTS = 3;
/** Longest wait we honour from a Retry-After header, so one busy board can't stall a search. */
const MAX_RETRY_WAIT_MS = 10_000;
/** No source reads more pages than this per search, whatever it asks for. */
export const PAGE_CEILING = 20;

export type SourceFetchOptions = {
  /**
   * Hostnames this request may reach, including after redirects. "*.example.com" matches any
   * subdomain of example.com (not example.com itself).
   */
  allowedHosts: readonly string[];
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Sent as JSON with a POST. */
  body?: unknown;
  timeoutMs?: number;
  /** Extra attempts after a network error, 429 or 5xx. */
  retries?: number;
};

export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

export function hostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts.some((pattern) => {
    const p = pattern.toLowerCase();
    return p.startsWith("*.") ? host.endsWith(p.slice(1)) && host.length > p.length - 1 : host === p;
  });
}

function checkUrl(url: URL, allowedHosts: readonly string[]): void {
  if (url.protocol !== "https:") throw new SourceHttpError(`Refused non-HTTPS URL: ${url.origin}`);
  if (!hostAllowed(url.hostname, allowedHosts)) throw new SourceHttpError(`Refused host: ${url.hostname}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(attempt: number, res?: Response): number {
  const header = res?.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
  return 500 * 2 ** attempt;
}

const retryable = (status: number) => status === 429 || status >= 500;

/** One request, following up to MAX_REDIRECTS redirects that stay on allowed hosts. */
async function request(url: URL, options: SourceFetchOptions): Promise<Response> {
  let current = url;
  for (let hop = 0; ; hop++) {
    checkUrl(current, options.allowedHosts);
    const res = await fetch(current, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel();
    if (hop >= MAX_REDIRECTS) throw new SourceHttpError("Too many redirects", res.status);
    current = new URL(location, current);
  }
}

/** Fetches a board's response, retrying network errors, 429 and 5xx. Throws on any other non-2xx. */
export async function sourceFetch(input: string | URL, options: SourceFetchOptions): Promise<Response> {
  const url = new URL(input);
  const retries = options.retries ?? DEFAULT_RETRIES;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await request(url, options);
    } catch (error) {
      // Our own refusals (bad host, too many redirects) never get better on retry.
      if (error instanceof SourceHttpError || attempt >= retries) throw error;
      await sleep(retryDelay(attempt));
      continue;
    }
    if (res.ok) return res;
    if (retryable(res.status) && attempt < retries) {
      await sleep(retryDelay(attempt, res));
      continue;
    }
    throw new SourceHttpError(`${url.hostname} responded ${res.status}`, res.status);
  }
}

export async function fetchJson<T>(input: string | URL, options: SourceFetchOptions): Promise<T> {
  const res = await sourceFetch(input, options);
  try {
    return (await res.json()) as T;
  } catch {
    throw new SourceHttpError(`${new URL(input).hostname} sent a response that isn't JSON`);
  }
}

/**
 * Reads pages until a page says it's the last, a page comes back empty, or `maxPages` (never more
 * than PAGE_CEILING) is reached. Waits `delayMs` between pages so we don't hammer the board.
 */
export async function fetchPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; done?: boolean }>,
  { maxPages, delayMs = 200 }: { maxPages: number; delayMs?: number },
): Promise<T[]> {
  const limit = Math.max(1, Math.min(Math.floor(maxPages) || 1, PAGE_CEILING));
  const all: T[] = [];
  for (let page = 0; page < limit; page++) {
    if (page > 0 && delayMs > 0) await sleep(delayMs);
    const { items, done } = await fetchPage(page);
    all.push(...items);
    if (done || items.length === 0) break;
  }
  return all;
}
