/**
 * Super-admin identity + authorization helpers.
 *
 * The super admin is a normal user row with role = 'superadmin'. They sign
 * in through the same Neon auth but land on a private control panel outside
 * the normal system flow. Permissions for a superadmin are always "all".
 */
import { DEFAULT_PERMS, type SystemPerms } from "./db";
import { sessionAction, uid } from "./store";

const SA_KEY = "flowday-superadmin-v1";

export type SuperAdminSession = {
  token: string;
  userId: string;
  email: string;
  name: string;
  /** Last issue/refresh time — drives sliding expiry like the app session. */
  issuedAt?: number;
};

export function readSaSession(): SuperAdminSession | null {
  try {
    const raw = localStorage.getItem(SA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuperAdminSession;
    if (!parsed?.token || !parsed?.userId) return null;
    const action = sessionAction(parsed.issuedAt, Date.now());
    if (action === "expired") {
      // The privileged session dies after 30 idle days — sign the panel out.
      localStorage.removeItem(SA_KEY);
      return null;
    }
    if (action === "stamp") {
      // Session from before expiry existed: anchor the window, don't kill it.
      const stamped: SuperAdminSession = { ...parsed, issuedAt: Date.now() };
      localStorage.setItem(SA_KEY, JSON.stringify(stamped));
      return stamped;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Rotate the panel token (sliding session), mirroring the app session. */
export function refreshSaSession(
  s: SuperAdminSession,
  now = Date.now(),
): SuperAdminSession {
  const next: SuperAdminSession = { ...s, token: uid() + uid(), issuedAt: now };
  writeSaSession(next);
  return next;
}

/** True when the stored session's token should be rotated on this visit. */
export function saSessionNeedsRefresh(s: SuperAdminSession, now = Date.now()): boolean {
  return sessionAction(s.issuedAt, now) === "refresh";
}

export function writeSaSession(s: SuperAdminSession | null) {
  try {
    if (s) localStorage.setItem(SA_KEY, JSON.stringify(s));
    else localStorage.removeItem(SA_KEY);
  } catch {
    // storage unavailable — in-memory only
  }
}

/** Resolve effective permissions for a user. */
export function effectivePerms(
  role: string | undefined,
  permissions: SystemPerms | null | undefined,
): SystemPerms {
  if (role === "superadmin") return { life: true, expense: true, business: true, salon: true, admin: true };
  return { ...DEFAULT_PERMS, ...(permissions ?? {}) };
}
