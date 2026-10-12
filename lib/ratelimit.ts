type RateEntry = { count: number; resetAt: number };
const memoryRateLimit = new Map<string, RateEntry>();
const WINDOW_MS = 60 * 1_000;
const MAX_REQUESTS = 5;

export function checkRateLimit(identifier: string) {
  const now = Date.now();
  const entry = memoryRateLimit.get(identifier);
  if (!entry || entry.resetAt <= now) {
    memoryRateLimit.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= MAX_REQUESTS, retryAfter: Math.ceil((entry.resetAt - now) / 1_000) };
}
