import type { AuthEventType } from "./db";

/**
 * Telegram hack alerts: every security event (see lib/security.ts) can also
 * push a message to the owner's Telegram so an attack is visible in real
 * time, not only in the superadmin panel.
 *
 * Delivery (when an email is known): a photo of the attempted account
 * (generated identicon — a browser CANNOT photograph the attacker; camera
 * access always needs an explicit permission prompt) with the core facts as
 * its caption, followed by a second message carrying the deep details
 * (geo, fingerprint, full user agent, page).
 *
 * Two modes, both best-effort and silent when unconfigured:
 *
 * 1. RELAY (recommended): `VITE_TELEGRAM_ALERT_URL` points at the Cloudflare
 *    Worker in /worker/telegram-alert.js, which holds the bot token as a
 *    server-side secret — the browser never sees the token.
 * 2. DIRECT: `VITE_TELEGRAM_BOT_TOKEN` + `VITE_TELEGRAM_CHAT_ID` call the
 *    Telegram API straight from the browser. Simple, but any VITE_ variable
 *    is compiled into the public bundle — anyone can read the token from
 *    view-source. Use only for a private/low-risk deployment.
 */

const TIMEOUT_MS = 4000;
/** Same alert type at most once per 30s — a failure storm sends one ping. */
export const ALERT_COOLDOWN_MS = 30_000;
/** Telegram's hard message limit is 4096; stay under it. */
const MAX_TEXT = 4000;
/** Photo captions are capped at 1024 characters. */
export const ALERT_CAPTION_MAX = 1024;

export type AlertEvent = {
  type: AuthEventType;
  email?: string | null;
  ip?: string | null;
  device?: string | null;
  geo?: string | null;
  /** Clickable map link for the attacker's approximate location. */
  map?: string | null;
  details?: string | null;
};

export function telegramAlertUrl(): string {
  return (import.meta.env.VITE_TELEGRAM_ALERT_URL as string | undefined) ?? "";
}

export function telegramToken(): string {
  return (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined) ?? "";
}

export function telegramChatId(): string {
  return (import.meta.env.VITE_TELEGRAM_CHAT_ID as string | undefined) ?? "";
}

/** True when at least one send mode is configured. */
export function telegramAlertEnabled(): boolean {
  const direct = Boolean(telegramToken() && telegramChatId());
  return Boolean(telegramAlertUrl()) || direct;
}

/** Owner-facing English labels (Telegram is not part of the app UI). */
export const ALERT_TYPE_LABEL: Record<AuthEventType, string> = {
  signin_fail: "Wrong password / unknown account",
  signin_blocked: "Sign-in blocked (too many attempts)",
  signup_exists: "Sign-up with an email that already exists",
  sa_fail: "Superadmin sign-in failed",
  sa_blocked: "Superadmin sign-in blocked (too many attempts)",
};

/**
 * Generated avatar for the attempted account — a deterministic picture per
 * email, so every attacker row is visually distinguishable in the chat.
 */
export function identiconUrl(email: string): string {
  const seed = encodeURIComponent(email.trim().toLowerCase());
  return `https://api.dicebear.com/9.x/identicon/png?seed=${seed}&size=256`;
}

/**
 * Full alert text (used when no photo can be attached). Plain text —
 * attacker-controlled fields must never break parsing. Pure.
 */
export function buildAlertText(event: AlertEvent & {
  userAgent?: string | null;
  page?: string | null;
  at?: number;
}): string {
  const lines = [
    "🚨 HACK ATTEMPT — Flowday",
    `Type: ${ALERT_TYPE_LABEL[event.type] ?? event.type}`,
    `Account: ${event.email || "—"}`,
    `IP: ${event.ip || "—"}`,
  ];
  if (event.geo) lines.push(`Location: ${event.geo}`);
  if (event.map) lines.push(`Map: ${event.map}`);
  if (event.ip) lines.push(`Trace: https://ipinfo.io/${event.ip}`);
  if (event.device) lines.push(`Device: ${event.device}`);
  if (event.details) lines.push(event.details);
  if (event.userAgent) lines.push(`User-Agent: ${event.userAgent}`);
  if (event.page) lines.push(`Page: ${event.page}`);
  lines.push(`Time: ${new Date(event.at ?? Date.now()).toLocaleString()}`);
  return lines.join("\n").slice(0, MAX_TEXT);
}

/**
 * Short version that fits a photo caption (≤1024): the headline facts only —
 * type, account, IP, location, trace link, device, time. Pure.
 */
export function buildAlertCore(event: AlertEvent & { at?: number }): string {
  const lines = [
    "🚨 HACK ATTEMPT — Flowday",
    `Type: ${ALERT_TYPE_LABEL[event.type] ?? event.type}`,
    `Account: ${event.email || "—"}`,
    `IP: ${event.ip || "—"}`,
  ];
  if (event.geo) lines.push(`Location: ${event.geo}`);
  if (event.map) lines.push(`Map: ${event.map}`);
  if (event.ip) lines.push(`Trace: https://ipinfo.io/${event.ip}`);
  if (event.device) lines.push(`Device: ${event.device}`);
  lines.push(`Time: ${new Date(event.at ?? Date.now()).toLocaleString()}`);
  return lines.join("\n").slice(0, ALERT_CAPTION_MAX);
}

/** Second message: deep details (fingerprint, user agent, page). Pure. */
export function buildAlertDetails(details: string): string {
  return `🔎 Details:\n${details}`.slice(0, MAX_TEXT);
}

/** Per-type cooldown check (pure — unit tested). */
export function cooldownOk(
  lastByType: Record<string, number>,
  type: string,
  now: number,
  windowMs: number = ALERT_COOLDOWN_MS,
): boolean {
  return now - (lastByType[type] ?? 0) >= windowMs;
}

/** Module-level cooldown state (per session). */
const lastSentAt: Record<string, number> = {};

async function postTelegram(
  path: "sendMessage" | "sendPhoto",
  body: Record<string, unknown>,
): Promise<void> {
  const relay = telegramAlertUrl();
  const target = relay || `https://api.telegram.org/bot${telegramToken()}/${path}`;
  const payload = relay ? body : { chat_id: telegramChatId(), ...body };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget alert. Silently no-ops when unconfigured, rate-limited, or
 * offline — alert delivery can never break the auth flow it reports on.
 */
export function sendSecurityAlert(event: AlertEvent): void {
  if (!telegramAlertEnabled()) return;
  const now = Date.now();
  if (!cooldownOk(lastSentAt, event.type, now)) return;
  lastSentAt[event.type] = now;

  void (async () => {
    try {
      const base = { ...event, at: now };
      if (event.email) {
        // Photo first (identicon of the attempted account), then details.
        await postTelegram("sendPhoto", {
          photo: identiconUrl(event.email),
          caption: buildAlertCore(base),
        });
        if (event.details) {
          await postTelegram("sendMessage", {
            text: buildAlertDetails(event.details),
          });
        }
      } else {
        await postTelegram("sendMessage", { text: buildAlertText(base) });
      }
    } catch {
      // Offline, timeout, or endpoint blocked — drop the alert.
    }
  })();
}

/**
 * Website (JavaScript) error alert — owner-facing English, plain text so
 * attacker- or framework-controlled strings can never break parsing. Pure.
 */
export function buildErrorText(input: {
  message: string;
  source?: string | null;
  page?: string | null;
  at?: number;
}): string {
  const lines = [
    "⚠️ WEBSITE ERROR — Flowday",
    `Error: ${input.message || "Unknown error"}`,
  ];
  if (input.source) lines.push(`Kind: ${input.source}`);
  if (input.page) lines.push(`Page: ${input.page}`);
  lines.push(`Time: ${new Date(input.at ?? Date.now()).toLocaleString()}`);
  return lines.join("\n").slice(0, MAX_TEXT);
}

/**
 * Fire-and-forget error ping. Cooldown/dedup lives in lib/monitor.ts (per
 * error fingerprint); delivery is best-effort like the attack alerts.
 */
export function sendErrorAlert(input: {
  message: string;
  source?: string | null;
  page?: string | null;
}): void {
  if (!telegramAlertEnabled()) return;
  void postTelegram("sendMessage", {
    text: buildErrorText({ ...input, at: Date.now() }),
  }).catch(() => {
    // Offline, timeout, or endpoint blocked — drop the alert.
  });
}
