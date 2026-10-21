/**
 * Fixed-window attempt limiter, in process memory.
 *
 * Enough for a single server instance. With several instances behind a load balancer each
 * keeps its own counts; move this to a shared store (for example Redis or a Postgres table)
 * at that point.
 */
import "server-only";

type Window = { count: number; resetAt: number };

const globalForLimits = globalThis as unknown as {
  __mmeRateLimits?: Map<string, Window>;
};
const windows = (globalForLimits.__mmeRateLimits ??= new Map());

/** Records one attempt. Returns false when the key has used up its attempts for this window. */
export function takeAttempt(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  if (windows.size > 10_000) {
    for (const [stored, window] of windows)
      if (window.resetAt <= now) windows.delete(stored);
  }

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  window.count += 1;
  return window.count <= limit;
}

/** Clears a key, e.g. after a successful sign-in. */
export function resetAttempts(key: string) {
  windows.delete(key);
}

/**
 * Client address from the proxy headers. Only trustworthy when the app runs behind a
 * proxy that overwrites X-Forwarded-For (the case on typical hosting).
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
