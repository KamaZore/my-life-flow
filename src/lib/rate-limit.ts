/**
 * Attempt throttling for the auth forms.
 *
 * Flowday's static build has no server process, so this is a *client-side*
 * backoff: it stops casual credential stuffing and scripted retries in the
 * browser (persisted in localStorage, so a reload does not reset the
 * counter). It is not a substitute for server-side rate limiting — real
 * enforcement belongs to the edge proxy described in docs/SECURITY.md.
 *
 * Pure core (`evalRate` / `failRate` / `clearRate`) takes and returns the
 * bucket map explicitly so it is unit-testable without a browser.
 */

export type RateBucket = {
  /** Failed attempts inside the current window. */
  fails: number;
  /** When the first fail of this window happened (window reset point). */
  windowStart: number;
  /** Until this timestamp the key is blocked. */
  blockedUntil: number;
};

export type RateMap = Record<string, RateBucket>;

export type RateResult = { ok: true } | { ok: false; retryInMs: number };

/** Attempts before any delay kicks in. */
export const RATE_FREE_ATTEMPTS = 3;
/** First backoff step; doubles per extra failure. */
export const RATE_STEP_MS = 10_000;
/** Never block longer than this. */
export const RATE_MAX_BLOCK_MS = 15 * 60 * 1000;
/** Idle window: no failure for this long resets the counter. */
export const RATE_WINDOW_MS = 15 * 60 * 1000;

const STORAGE_KEY = "flowday-rate-v1";
/** Safety valve so a pathological map can never bloat storage. */
const MAX_KEYS = 50;

/** Backoff for a failure count (0 failures → no block). */
export function backoffMs(fails: number): number {
  if (fails < RATE_FREE_ATTEMPTS) return 0;
  const steps = fails - RATE_FREE_ATTEMPTS; // 3 → 1 step, 4 → 2 steps …
  return Math.min(RATE_STEP_MS * 2 ** steps, RATE_MAX_BLOCK_MS);
}

function liveBucket(bucket: RateBucket | undefined, now: number): RateBucket | undefined {
  if (!bucket) return undefined;
  // The window lapsed without new failures → the counter starts over.
  if (bucket.fails > 0 && now - bucket.windowStart > RATE_WINDOW_MS) return undefined;
  return bucket;
}

/** Is this key currently allowed to attempt? Pure. */
export function evalRate(map: RateMap, key: string, now: number): RateResult {
  const bucket = liveBucket(map[key], now);
  if (!bucket) return { ok: true };
  if (bucket.blockedUntil > now) return { ok: false, retryInMs: bucket.blockedUntil - now };
  return { ok: true };
}

/** Record one failed attempt (starts/extends the backoff). Pure. */
export function failRate(map: RateMap, key: string, now: number): RateMap {
  const prev = liveBucket(map[key], now);
  const fails = (prev?.fails ?? 0) + 1;
  const windowStart = prev?.windowStart ?? now;
  const block = backoffMs(fails);
  const next: RateBucket = {
    fails,
    windowStart,
    blockedUntil: block > 0 ? now + block : 0,
  };
  const out: RateMap = { ...map, [key]: next };
  // Keep storage bounded: drop the oldest keys beyond the cap.
  const keys = Object.keys(out);
  if (keys.length > MAX_KEYS) {
    for (const k of keys.slice(0, keys.length - MAX_KEYS)) delete out[k];
  }
  return out;
}

/** Successful auth clears the key entirely. Pure. */
export function clearRate(map: RateMap, key: string): RateMap {
  if (!(key in map)) return map;
  const out = { ...map };
  delete out[key];
  return out;
}

/* ------------------------------------------------------------------ */
/* localStorage-backed helpers (thin glue over the pure core)          */
/* ------------------------------------------------------------------ */

function readMap(): RateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RateMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: RateMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode) — throttling degrades to per-tab.
  }
}

/** Check whether `key` may attempt right now. */
export function rateCheck(key: string, now = Date.now()): RateResult {
  return evalRate(readMap(), key, now);
}

/** Record a failed attempt for `key`. */
export function rateFail(key: string, now = Date.now()): void {
  writeMap(failRate(readMap(), key, now));
}

/** Clear `key` after a successful auth. */
export function rateClear(key: string): void {
  const map = readMap();
  if (!(key in map)) return;
  writeMap(clearRate(map, key));
}
