import {
  hasDb,
  pingDatabase,
  recordAppError,
  type AppErrorSource,
  type ProbeResult,
} from "./db";
import { IP_ECHO_URL } from "./security";
import {
  cooldownOk,
  sendErrorAlert,
  telegramAlertUrl,
  telegramChatId,
  telegramToken,
} from "./telegram";

/**
 * Website monitoring for the superadmin panel:
 *
 * 1. HEALTH — runHealthChecks() probes everything the deployed site depends
 *    on (GitHub Pages itself, the Neon database, the Telegram alert relay /
 *    bot API, and the IP echo service) and reports per-service status +
 *    round-trip latency. Checks run from the viewer's browser on demand and
 *    every 60s while the Monitoring tab is open; they are visibility, not
 *    enforcement.
 *
 * 2. ERRORS — installErrorCapture() hooks uncaught JavaScript errors and
 *    unhandled promise rejections (plus React boundary crashes reported via
 *    reportAppError). Each error is fingerprinted, stored in the `app_errors`
 *    table (grouped, hit-counted) and pinged to Telegram at most once per
 *    fingerprint per ERROR_ALERT_COOLDOWN_MS.
 *
 * Everything here is best-effort and must never throw into the code path it
 * observes: probes time out, the database may be unreachable, and alerts are
 * fire-and-forget.
 */

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** 32-bit FNV-1a — stable, tiny, no dependencies. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Path (origin stripped, hash route kept) of a page URL, capped — used in
 * error fingerprints so the same bug on two screens groups separately. Pure.
 */
export function routeOf(href: string | null | undefined): string {
  if (!href) return "";
  try {
    const u = new URL(href, "https://fallback.local");
    return `${u.pathname}${u.search}${u.hash}`.slice(0, 80);
  } catch {
    return String(href).slice(0, 80);
  }
}

/**
 * Grouping key for one error: a content hash plus a short readable slug.
 * Deterministic, whitespace-normalized, ≤64 chars (the db.ts cap). Pure.
 */
export function errorFingerprint(
  source: string,
  message: string,
  page?: string | null,
): string {
  const msg = message.replace(/\s+/g, " ").trim().slice(0, 120) || "unknown error";
  const route = routeOf(page);
  const hash = fnv1a(`${source}|${msg}|${route}`).toString(16).padStart(8, "0");
  const slug = msg
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug ? `${hash}-${slug}` : hash;
}

/** Aggregate check results into one status word (pure — unit tested). */
export function overallHealth(
  checks: { ok: boolean }[],
): "ok" | "degraded" | "down" {
  if (!checks.length) return "ok";
  const fails = checks.filter((c) => !c.ok).length;
  if (fails === 0) return "ok";
  return fails === checks.length ? "down" : "degraded";
}

/* ------------------------------------------------------------------ */
/* Health probes                                                       */
/* ------------------------------------------------------------------ */

export const PROBE_TIMEOUT_MS = 5000;

/**
 * GET `url` with no caching, bounded by a timeout. Never throws — network
 * failure becomes { ok: false, note: "timeout" | "unreachable" }. Pure-ish
 * glue (network), exported for tests that inject fetch.
 */
export async function probeUrl(
  url: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  if (!url) return { ok: false, ms: 0, note: "not_configured" };
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok
      ? { ok: true, ms: Date.now() - t0, note: null }
      : { ok: false, ms: Date.now() - t0, note: `http_${res.status}` };
  } catch {
    return {
      ok: false,
      ms: Date.now() - t0,
      note: controller.signal.aborted ? "timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type HealthId = "site" | "database" | "telegram" | "ip";
export type HealthCheck = { id: HealthId } & ProbeResult;
export type HealthDeps = {
  /** The deployed app itself (GitHub Pages round trip). */
  siteUrl: string;
  /** Keyless IP echo service (proves outbound internet + CORS path). */
  ipEchoUrl: string;
  probeUrl: (url: string) => Promise<ProbeResult>;
  pingDb: () => Promise<ProbeResult>;
  /** null = no alert delivery configured. */
  telegramUrl: { kind: "direct" | "relay"; url: string } | null;
};

/** Real dependencies: current page URL, live config, real network probes. */
export function defaultHealthDeps(): HealthDeps {
  const relay = telegramAlertUrl();
  const token = telegramToken();
  const chat = telegramChatId();
  let telegramUrl: HealthDeps["telegramUrl"] = null;
  if (relay) telegramUrl = { kind: "relay", url: relay };
  else if (token && chat)
    telegramUrl = {
      kind: "direct",
      url: `https://api.telegram.org/bot${token}/getMe`,
    };
  const siteUrl =
    typeof location !== "undefined" && location.href
      ? location.origin + location.pathname
      : "";
  return {
    siteUrl,
    ipEchoUrl: IP_ECHO_URL,
    probeUrl: (url) => probeUrl(url),
    pingDb: pingDatabase,
    telegramUrl,
  };
}

/**
 * Probe all four dependencies in parallel. Never rejects — individual probe
 * failures become { ok: false } rows so the UI can always render.
 */
export async function runHealthChecks(deps: HealthDeps): Promise<HealthCheck[]> {
  const [site, database, telegram, ip] = await Promise.all([
    deps.probeUrl(deps.siteUrl),
    deps.pingDb(),
    deps.telegramUrl
      ? deps.probeUrl(deps.telegramUrl.url)
      : Promise.resolve<ProbeResult>({ ok: true, ms: 0, note: "not_configured" }),
    deps.probeUrl(deps.ipEchoUrl),
  ]);
  return [
    { id: "site", ...site },
    { id: "database", ...database },
    { id: "telegram", ...telegram },
    { id: "ip", ...ip },
  ];
}

/* ------------------------------------------------------------------ */
/* Website error capture                                               */
/* ------------------------------------------------------------------ */

/** One Telegram ping per error fingerprint at most every 10 minutes. */
export const ERROR_ALERT_COOLDOWN_MS = 10 * 60 * 1000;
/** Bounded dedupe map so a session with many distinct errors stays small. */
const ERROR_ALERT_MAX_KEYS = 200;
const lastErrorAlertAt: Record<string, number> = {};

/** Best-effort message extraction from anything thrown/rejected. */
export function errorMessage(err: unknown, depth = 0): string {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (depth < 3 && err && typeof err === "object") {
    const e = err as { message?: unknown; reason?: unknown; error?: unknown };
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
    // Some rejections wrap the real error one level down (bounded depth —
    // malformed reasons must not recurse forever).
    if (e.reason !== undefined && e.reason !== err) {
      const nested = errorMessage(e.reason, depth + 1);
      if (nested !== "Unknown error") return nested;
    }
    if (e.error !== undefined && e.error !== err) {
      const nested = errorMessage(e.error, depth + 1);
      if (nested !== "Unknown error") return nested;
    }
  }
  try {
    return JSON.stringify(err)?.slice(0, 200) ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

/**
 * Record one website error: deduped Telegram ping first (works even when the
 * database is down), then a grouped row in `app_errors`. Never throws.
 */
export function reportAppError(
  source: AppErrorSource,
  err: unknown,
  page?: string | null,
): void {
  try {
    const message = errorMessage(err);
    const href =
      page ?? (typeof location !== "undefined" ? location.href : null);
    const fp = errorFingerprint(source, message, href);

    const now = Date.now();
    const key = `err:${fp}`;
    if (cooldownOk(lastErrorAlertAt, key, now, ERROR_ALERT_COOLDOWN_MS)) {
      const keys = Object.keys(lastErrorAlertAt);
      if (keys.length >= ERROR_ALERT_MAX_KEYS) delete lastErrorAlertAt[keys[0]];
      lastErrorAlertAt[key] = now;
      sendErrorAlert({ message, source, page: href });
    }

    if (!hasDb) return;
    void recordAppError({ fp, message, source, page: href }).catch(() => {
      // Offline / quota / schema failure — telemetry is best-effort.
    });
  } catch {
    // Monitoring must never throw into the code path it observes.
  }
}

/**
 * Listen for uncaught errors + unhandled rejections. Returns a cleanup that
 * removes the listeners (StrictMode-safe: install/uninstall symmetric).
 * Resource load failures (script/img tags) are skipped — they carry a target
 * element and would flood the log without telling us anything new.
 */
export function installErrorCapture(): () => void {
  if (typeof window === "undefined") return () => {};
  const onError = (ev: ErrorEvent): void => {
    const target = ev.target as { tagName?: unknown } | null;
    if (
      target &&
      target !== (window as unknown as { tagName?: unknown }) &&
      typeof target.tagName === "string"
    ) {
      return; // element resource error, not an uncaught JS error
    }
    reportAppError("global", ev.error ?? ev.message);
  };
  const onRejection = (ev: PromiseRejectionEvent): void => {
    reportAppError("rejection", ev.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
