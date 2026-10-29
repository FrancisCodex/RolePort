import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guard for URLs that come from a user (a careers page to follow, a pasted job link). The server
 * fetches them, so without this a URL could reach the user's own network, the host's internal
 * services or the cloud metadata address. Hosts are checked before the request and again for
 * every redirect.
 *
 * Limit: the address is resolved here and again by fetch, so a hostile DNS server could answer
 * differently the second time (DNS rebinding). Pinning the address would need a custom undici
 * dispatcher; until then, keep responses from these fetches out of anything privileged.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet", ".corp"];

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
];

/** Expands an IPv6 address into its eight 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  let address = ip.toLowerCase().split("%")[0];
  // A trailing dotted IPv4 (::ffff:1.2.3.4) becomes two groups.
  const v4 = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    address = address.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.split("::");
  const parse = (s: string | undefined) => (s ? s.split(":").map((g) => parseInt(g, 16)) : []);
  const left = parse(head);
  const right = parse(tail);
  const fill = address.includes("::") ? new Array(8 - left.length - right.length).fill(0) : [];
  return [...left, ...fill, ...right];
}

/** True for loopback, private, link-local, multicast, reserved and documentation addresses. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return PRIVATE_V4.some(([base, bits]) => inV4Range(ip, base, bits));
  if (version !== 6) return true; // Not an IP at all: never treat as safe.

  const g = ipv6Groups(ip);
  if (g.length !== 8 || g.some((n) => Number.isNaN(n))) return true;
  const embeddedV4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return isPrivateAddress(embeddedV4); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) return isPrivateAddress(embeddedV4); // NAT64
  if (g.slice(0, 7).every((n) => n === 0)) return true; // :: and ::1 (and the deprecated ::a.b.c.d)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 old site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/**
 * Parses and checks a user-supplied URL: http(s) only, default ports, no user:password, and a host
 * that resolves only to public addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("That isn't a valid link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https links work.");
  if (url.username || url.password) throw new UnsafeUrlError("Links with a username or password aren't allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Links to unusual ports aren't allowed.");

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("That link points to a private or local address.");
    return url;
  }
  if (host === "localhost" || !host.includes(".") || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That link points to a private or local address.");
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError(`Couldn't find ${host}. Check the link.`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("That link points to a private or local address.");
  }
  return url;
}

export type SafeFetchResult = { url: string; status: number; contentType: string; body: string };

/**
 * Fetches a user-supplied URL as text: every hop passes assertPublicUrl, at most MAX_REDIRECTS
 * redirects, and the body is cut off at `maxBytes`.
 */
export async function safeFetchText(
  input: string | URL,
  { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, accept = "text/html,application/json;q=0.9,*/*;q=0.5" } = {},
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = await assertPublicUrl(input);

  for (let hop = 0; ; hop++) {
    const res = await fetch(url, {
      headers: { Accept: accept, "User-Agent": "RolePort/0.1 (job search)" },
      redirect: "manual",
      signal,
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new UnsafeUrlError("That link redirects too many times.");
      url = await assertPublicUrl(new URL(location, url));
      continue;
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: await readCapped(res, maxBytes),
    };
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - total;
    if (value.byteLength >= room) {
      chunks.push(value.subarray(0, room));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
