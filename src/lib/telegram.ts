import type { AuthEventType } from "./db";

/**
 * Telegram hack alerts: every security event (see lib/security.ts) can also
 * push a message to the owner's Telegram so an attack is visible in real
 * time, not only in the superadmin panel.
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
 * Compose the alert text (plain text — attacker-controlled fields must never
 * break parsing). Pure: inputs injected, output capped under Telegram's limit.
 */
export function buildAlertText(event: {
  type: AuthEventType;
  email?: string | null;
  ip?: string | null;
  device?: string | null;
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
  if (event.ip) lines.push(`Trace: https://ipinfo.io/${event.ip}`);
  if (event.device) lines.push(`Device: ${event.device}`);
  if (event.userAgent) lines.push(`User-Agent: ${event.userAgent}`);
  if (event.page) lines.push(`Page: ${event.page}`);
  lines.push(`Time: ${new Date(event.at ?? Date.now()).toLocaleString()}`);
  return lines.join("\n").slice(0, MAX_TEXT);
}

/** Per-type cooldown check (pure — unit tested). */
export function cooldownOk(
  lastByType: Record<string, number>,
  type: string,
  now: number,
): boolean {
  return now - (lastByType[type] ?? 0) >= ALERT_COOLDOWN_MS;
}

/** Module-level cooldown state (per session). */
const lastSentAt: Record<string, number> = {};

/**
 * Fire-and-forget alert. Silently no-ops when unconfigured, rate-limited, or
 * offline — alert delivery can never break the auth flow it reports on.
 */
export function sendSecurityAlert(event: {
  type: AuthEventType;
  email?: string | null;
  ip?: string | null;
  device?: string | null;
}): void {
  if (!telegramAlertEnabled()) return;
  const now = Date.now();
  if (!cooldownOk(lastSentAt, event.type, now)) return;
  lastSentAt[event.type] = now;

  void (async () => {
    try {
      const hasWindow = typeof window !== "undefined";
      const text = buildAlertText({
        ...event,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        page: hasWindow ? window.location.href : null,
        at: now,
      });
      const relay = telegramAlertUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(
        relay || `https://api.telegram.org/bot${telegramToken()}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: relay
            ? JSON.stringify({ text })
            : JSON.stringify({ chat_id: telegramChatId(), text }),
          signal: controller.signal,
        },
      );
      clearTimeout(timer);
      void res; // best effort — Telegram errors are not surfaced anywhere
    } catch {
      // Offline, timeout, or endpoint blocked — drop the alert.
    }
  })();
}
