import { recordAuthEvent, type AuthEventType } from "./db";
import { sendSecurityAlert } from "./telegram";

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
export const IP_ECHO_URL = "https://api.ipify.org?format=json";
const IP_ENDPOINT = IP_ECHO_URL;
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

/* ------------------------------------------------------------------ */
/* Rich context: IP geolocation + device fingerprint                   */
/* ------------------------------------------------------------------ */

/** Keyless, CORS-enabled IP geolocation (country/city/ISP). */
const GEO_ENDPOINT = "https://ipwho.is/";
const GEO_TIMEOUT_MS = 2500;

/** Format geo parts into one line: "City, Country · ISP" (pure). */
export function formatGeo(city: unknown, country: unknown, isp: unknown): string | null {
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 60) : "");
  const place = [clean(city), clean(country)].filter(Boolean).join(", ");
  const provider = clean(isp);
  const out = provider ? (place ? `${place} · ${provider}` : provider) : place;
  return out || null;
}

/**
 * Clickable map URL for coordinates (pure — unit tested). Returns null for
 * missing / out-of-range / (0,0) values — (0,0) is the common "no fix".
 */
export function formatMapLink(lat: unknown, lon: unknown): string | null {
  const num = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max ? v : null;
  const la = num(lat, 90);
  const lo = num(lon, 180);
  if (la === null || lo === null) return null;
  if (la === 0 && lo === 0) return null;
  return `https://www.google.com/maps?q=${la.toFixed(4)},${lo.toFixed(4)}`;
}

export type GeoInfo = {
  /** "City, Country · ISP" line for the alert / stored details. */
  line: string;
  /** Clickable map link when coordinates were resolved, else null. */
  map: string | null;
};

/** Best-effort location for an IP — null when offline/unknown. */
export async function getIpGeo(ip: string): Promise<GeoInfo | null> {
  if (!looksLikeIp(ip)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(`${GEO_ENDPOINT}${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      city?: unknown;
      country?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      connection?: { isp?: unknown };
    };
    if (data.success === false) return null;
    const line = formatGeo(data.city, data.country, data.connection?.isp);
    const map = formatMapLink(data.latitude, data.longitude);
    if (!line && !map) return null;
    return { line: line ?? "", map };
  } catch {
    return null; // enrichment is optional — the alert still sends without it
  }
}

/** Join non-empty detail lines into one block (pure — unit tested). */
export function formatFingerprint(
  parts: (string | null | undefined | false)[],
): string {
  return parts.filter((p): p is string => Boolean(p)).join("\n");
}

let fingerprintCache: string | null = null;

function webglRenderer(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return String(renderer ?? "").slice(0, 80);
  } catch {
    return "";
  }
}

function canvasHash(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#069";
    ctx.fillText("flowday", 2, 12);
    const data = canvas.toDataURL();
    let hash = 5381;
    for (let i = 0; i < data.length; i++) hash = ((hash * 33) ^ data.charCodeAt(i)) >>> 0;
    return hash.toString(16).padStart(8, "0");
  } catch {
    return "";
  }
}

/**
 * Hardware/software fingerprint (cores, RAM, GPU, canvas hash, DPR, screen,
 * touch, connection) — collected once per session, every part optional.
 */
export function collectFingerprint(): string {
  if (fingerprintCache !== null) return fingerprintCache;
  const parts: string[] = [];
  try {
    if (typeof navigator !== "undefined") {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        userAgentData?: { platform?: string; mobile?: boolean };
      };
      if (nav.hardwareConcurrency) parts.push(`${nav.hardwareConcurrency} cores`);
      if (nav.deviceMemory) parts.push(`${nav.deviceMemory}GB RAM`);
      if (nav.userAgentData?.platform) {
        parts.push(nav.userAgentData.platform + (nav.userAgentData.mobile ? " mobile" : ""));
      }
      if (nav.maxTouchPoints) parts.push(`${nav.maxTouchPoints} touch points`);
      const conn = (nav as unknown as { connection?: { effectiveType?: string } }).connection;
      if (conn?.effectiveType) parts.push(conn.effectiveType);
    }
    if (typeof window !== "undefined") {
      if (window.devicePixelRatio) parts.push(`${window.devicePixelRatio}x DPR`);
      if (window.screen) {
        parts.push(`${window.screen.width}x${window.screen.height}@${window.screen.colorDepth}bit`);
      }
      const gpu = webglRenderer();
      if (gpu) parts.push(gpu);
      const canvasFp = canvasHash();
      if (canvasFp) parts.push(`canvas ${canvasFp}`);
    }
  } catch {
    // Fingerprinting is opportunistic — missing APIs just drop a part.
  }
  fingerprintCache = parts.join(" · ");
  return fingerprintCache;
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
      const geoInfo = ip ? await getIpGeo(ip) : null;
      const geo = geoInfo?.line || null;
      const map = geoInfo?.map ?? null;
      const hasWindow = typeof window !== "undefined";
      const device = buildDeviceLabel({
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        platform: typeof navigator !== "undefined" ? navigator.platform : "",
        width: hasWindow ? window.screen?.width : undefined,
        height: hasWindow ? window.screen?.height : undefined,
        language: typeof navigator !== "undefined" ? navigator.language : "",
        timezone: timezoneLabel(),
      });
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const fp = collectFingerprint();
      const detailBlock = formatFingerprint([
        fp && `Fingerprint: ${fp}`,
        ua ? `User-Agent: ${ua}` : "",
        hasWindow ? `Page: ${window.location.href}` : "",
      ]);
      await recordAuthEvent({
        type,
        email,
        ip,
        device,
        details: formatFingerprint([
          geo ? `Location: ${geo}` : "",
          map ? `Map: ${map}` : "",
          detailBlock,
        ]),
      });
      // Real-time ping to the owner's Telegram (no-op when unconfigured).
      sendSecurityAlert({ type, email, ip, device, geo, map, details: detailBlock });
    } catch {
      // Telemetry is best-effort — never surface it to the user.
    }
  })();
}
