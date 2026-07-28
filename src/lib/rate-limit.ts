import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-process rate limit. Best-effort on serverless (per-instance). */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      ok: false as const,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now)
    };
  }

  existing.count += 1;
  return { ok: true as const, remaining: limit - existing.count };
}

export function clientKeyFromHeaders(headers: Headers, prefix: string) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown";
  return `${prefix}:${ip}`;
}
