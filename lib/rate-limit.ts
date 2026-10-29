/**
 * A best-effort token bucket per key (an IP address), kept in this server instance's memory.
 * Serverless hosts run several instances, so pair it with the host's own rate limiting.
 */
export function createRateLimit({ capacity, refillPerMinute }: { capacity: number; refillPerMinute: number }) {
  const buckets = new Map<string, { tokens: number; at: number }>();

  /** Takes a token for `key`. Returns 0 when allowed, else the seconds to wait. */
  return function take(key: string, now = Date.now()): number {
    const bucket = buckets.get(key) ?? { tokens: capacity, at: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.at) / 60_000) * refillPerMinute);
    bucket.at = now;
    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      return Math.ceil(((1 - bucket.tokens) / refillPerMinute) * 60);
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    // Forget the oldest entries so memory stays bounded.
    if (buckets.size > 10_000) buckets.delete(buckets.keys().next().value!);
    return 0;
  };
}

/** The caller's address behind the host's proxy, for rate-limit keys. */
export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
