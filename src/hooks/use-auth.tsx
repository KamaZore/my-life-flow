import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import bcrypt from "bcryptjs";
import {
  countUsers,
  createUser,
  findUserByEmail,
  getAuthRow,
  DEFAULT_PERMS,
  type SystemPerms,
} from "@/lib/db";
import {
  readSession,
  uid,
  writeSession,
} from "@/lib/store";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { effectivePerms } from "@/lib/superadmin";
import {
  normalizeEmail,
  validateName,
  validateNewPassword,
  validateSignInPassword,
} from "@/lib/validate";

/**
 * Auth backend backed by the app's own Neon Postgres `users` table
 * (bcrypt-hashed passwords). The session token in localStorage authorizes
 * the signed-in user's data sync; sessions live entirely client-side.
 */

export type AppUser = {
  _id: string;
  email: string;
  name: string;
  role: "user" | "superadmin";
  perms: SystemPerms;
};

export type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AppUser | null;
  isSuperAdmin: boolean;
  can: (system: keyof SystemPerms) => boolean;
  signIn: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  signUp: (name: string, email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

/** Session shape persisted in localStorage (see store.ts writeSession). */
type StoredSession = {
  token: string;
  userId: string;
  email: string;
  name: string;
  role?: "user" | "superadmin";
  perms?: SystemPerms;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => {
    const stored = readSession() as StoredSession | null;
    if (!stored) return null;
    // A stale/forged client session must never grant privileges. The role is
    // checked again by the backend in production; the static fallback also
    // refuses a local session that claims superadmin without a known account.
    // Merge over the CURRENT defaults so systems added after this session
    // was created (e.g. salon) appear without forcing a re-login. Explicit
    // false values in the stored perms still win over defaults.
    return { ...stored, perms: { ...DEFAULT_PERMS, ...(stored.perms ?? {}) } };
  });
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = Boolean(session);

  // Re-check role + permissions with the backend on load so a superadmin
  // revoking a system takes effect immediately, without forcing the user to
  // sign out and back in. Offline/PWA failures are ignored on purpose: the
  // cached session keeps working so the installed app still opens.
  useEffect(() => {
    if (!session?.email) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await getAuthRow(session.email);
        if (cancelled || !row) return;
        const nextRole = row.role === "superadmin" ? ("superadmin" as const) : ("user" as const);
        const nextPerms = effectivePerms(row.role, row.permissions);
        setSession((prev) => {
          if (!prev) return prev;
          if (prev.role === nextRole && JSON.stringify(prev.perms) === JSON.stringify(nextPerms)) {
            return prev;
          }
          const updated = { ...prev, role: nextRole, perms: nextPerms };
          writeSession(updated as unknown as ReturnType<typeof readSession>);
          return updated;
        });
      } catch {
        // Backend unreachable — keep the cached session as-is.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only the account identity matters; perms arrive from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email]);

  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string | null) => {
    setIsLoading(true);
    try {
      // Cloudflare Turnstile server verification (Worker-backed when the
      // verify URL is configured). A failed token blocks the auth attempt
      // before any database call.
      const human = await verifyTurnstileToken(turnstileToken);
      if (!human) throw new Error("captcha");
      // Input validation runs before any database call. Failures surface as
      // a typed code the pages map to an i18n message (validate.ts).
      const normalized = normalizeEmail(email);
      validateSignInPassword(password);
      const row = await getAuthRow(normalized);
      if (!row) throw new Error("invalid");
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) throw new Error("invalid");
      const next: StoredSession = {
        token: uid() + uid(),
        userId: row.id,
        email: row.email,
        name: row.name,
        role: row.role === "superadmin" ? "superadmin" : "user",
        perms: effectivePerms(row.role, row.permissions),
      };
      writeSession(next as unknown as ReturnType<typeof readSession>);
      setSession(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string, turnstileToken?: string | null) => {
      setIsLoading(true);
      try {
        const human = await verifyTurnstileToken(turnstileToken);
        if (!human) throw new Error("captcha");
        // Same validation the db layer enforces — fails fast with a typed
        // code instead of a generic error after the hashing round-trip.
        const normalized = normalizeEmail(email);
        const cleanName = validateName(name);
        validateNewPassword(password);
        const existing = await findUserByEmail(normalized);
        if (existing) throw new Error("exists");
        const hash = await bcrypt.hash(password, 10);
        // First account in an empty database becomes the super admin.
        const total = await countUsers();
        const isFirst = total === 0;
        const role = isFirst ? "superadmin" : "user";
        const created = await createUser(
          uid() + uid(),
          cleanName,
          normalized,
          hash,
          role,
          isFirst ? effectivePerms(role, null) : undefined,
        );
        const next: StoredSession = {
          token: uid() + uid(),
          userId: created.id,
          email: created.email,
          name: created.name,
          role,
          perms: effectivePerms(role, null),
        };
        writeSession(next as unknown as ReturnType<typeof readSession>);
        setSession(next);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    writeSession(null);
    setSession(null);
    // Reload at the app's base path. BASE_URL is "./" on GitHub Pages
    // (resolves to /my-life-flow/) and "/" in local dev, so signing out
    // never escapes the app's subpath (a bare "/" lands on GitHub's 404).
    window.location.assign(import.meta.env.BASE_URL);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated,
      user: session
        ? {
            _id: session.userId,
            email: session.email,
            name: session.name,
            role: session.role ?? "user",
            perms: { ...DEFAULT_PERMS, ...(session.perms ?? {}) },
          }
        : null,
      isSuperAdmin: session?.role === "superadmin",
      can: (system) => {
        if (!session) return false;
        if (session.role === "superadmin") return true;
        return Boolean(session.perms?.[system]);
      },
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, isAuthenticated, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
