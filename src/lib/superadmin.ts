/**
 * Super-admin identity + authorization helpers.
 *
 * The super admin is a normal user row with role = 'superadmin'. They sign
 * in through the same Neon auth but land on a private control panel outside
 * the normal system flow. Permissions for a superadmin are always "all".
 */
import { DEFAULT_PERMS, type SystemPerms } from "./db";

const SA_KEY = "flowday-superadmin-v1";

export type SuperAdminSession = {
  token: string;
  userId: string;
  email: string;
  name: string;
};

export function readSaSession(): SuperAdminSession | null {
  try {
    const raw = localStorage.getItem(SA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuperAdminSession;
    return parsed?.token && parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
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
