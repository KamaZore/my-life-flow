import { recordAuthEvent, type AuthEventType } from "./db";

/**
 * Security telemetry: enriches failed / blocked sign-in attempts with the
 * client's public IP and device before they land in the `auth_events` table
 * (visible in the superadmin panel).
 *
 * Everything here is best-effort and client-side — the only model available
 * for a static build. It is visibility, not enforcement: a determined
 * attacker can block the IP endpoint or skip the client entirely, so real
 * protection still belongs to the edge proxy in docs/SECURITY.md.
 */

/** Keyless, CORS-enabled JSON IP echo; cached so we call it rarely. */
const IP_ENDPOINT = "https://api.ipify.org?format=json";
const IP_CACHE_KEY = "flowday-ip-v1";
const IP_TTL_MS = 24 * 60 * 60 * 1000;
const IP_TIMEOUT_MS = 3000;
const DEVICE_MAX = 180;

/** Loose IPv4/IPv6 shape check (pure — unit tested). */
export function looksLikeIp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ip = value.trim();
  if (ip.length < 3 || ip.length > 45) return false;
  if (!/^[0-9a-fA-F:.]+$/.test(ip)) return false;
  return /[.:]/.test(ip);
}

/**
 * Compact one-line device descriptor, e.g.
 * "Chrome · Windows · 1920x1080 · en-US · Asia/Phnom_Penh".
 * Pure (inputs injected) so it is unit-testable without a browser.
 */
export function buildDeviceLabel(parts: {
  userAgent?: string;
  platform?: string;
  width?: number;
  height?: number;
  language?: string;
  timezone?: string;
}): string {
  const ua = parts.userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : (parts.platform ?? "");
  const screen = parts.width && parts.height ? `${parts.width}x${parts.height}` : "";
  return [browser, os, screen, parts.language ?? "", parts.timezone ?? ""]
    .filter(Boolean)
    .join(" · ")
    .slice(0, DEVICE_MAX);
}

/** Public IP of this device — cached in localStorage for a day. */
export async function getClientIp(now = Date.now()): Promise<string | null> {
  try {
    const raw = localStorage.getItem(IP_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { ip?: unknown; at?: unknown };
      if (
        typeof cached.ip === "string" &&
        typeof cached.at === "number" &&
        now - cached.at < IP_TTL_MS &&
        looksLikeIp(cached.ip)
      ) {
        return cached.ip;
      }
    }
  } catch {
    // No storage / corrupt cache — fall through to the network lookup.
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_TIMEOUT_MS);
    const res = await fetch(IP_ENDPOINT, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: unknown };
    if (!looksLikeIp(data.ip)) return null;
    try {
      localStorage.setItem(IP_CACHE_KEY, JSON.stringify({ ip: data.ip, at: now }));
    } catch {
      // Private mode — just skip caching.
    }
    return data.ip;
  } catch {
    // Offline, endpoint blocked, or timed out — event still records without IP.
    return null;
  }
}

function timezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * Record a suspicious auth event (failed / blocked sign-in). Fire-and-forget:
 * any failure (offline, no DB URL, blocked IP endpoint) is swallowed so
 * telemetry can never break the auth flow it observes.
 */
export function trackSecurityEvent(type: AuthEventType, email?: string | null): void {
  void (async () => {
    try {
      const ip = await getClientIp();
      const hasWindow = typeof window !== "undefined";
      const device = buildDeviceLabel({
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        platform: typeof navigator !== "undefined" ? navigator.platform : "",
        width: hasWindow ? window.screen?.width : undefined,
        height: hasWindow ? window.screen?.height : undefined,
        language: typeof navigator !== "undefined" ? navigator.language : "",
        timezone: timezoneLabel(),
      });
      await recordAuthEvent({ type, email, ip, device });
    } catch {
      // Telemetry is best-effort — never surface it to the user.
    }
  })();
}
