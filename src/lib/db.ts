import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon Postgres backend (replaces Convex).
 *
 * Neon is the persistence layer. In the current static GitHub Pages build the
 * browser talks to Neon directly, so a public VITE_NEON_DATABASE_URL is not a
 * secret and cannot provide server-side authorization. The client uses strict
 * owner/session checks to prevent accidental cross-account access, but the
 * production boundary must be a server/edge proxy using a private Neon
 * credential plus the RLS migration in scripts/security-migration.sql.
 *
 * Do not ship a privileged public connection string. See docs/SECURITY.md for
 * the required deployment boundary and API contract.
 */

export const DATABASE_URL = import.meta.env.VITE_NEON_DATABASE_URL as
  | string
  | undefined;

/** True when the Neon connection string is present. */
export const hasDb = Boolean(DATABASE_URL);

let sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    if (!DATABASE_URL) {
      throw new Error("Missing VITE_NEON_DATABASE_URL");
    }
    sql = neon(DATABASE_URL);
  }
  return sql;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let schemaPromise: Promise<void> | null = null;

/** Idempotently create the users + app_data tables. Memoized per session. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const s = getSql();
      await s`
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL DEFAULT '',
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role          TEXT NOT NULL DEFAULT 'user',
          permissions   JSONB,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Migration for tables created before roles existed
      await s`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
      await s`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB`;
      await s`
        CREATE TABLE IF NOT EXISTS app_data (
          user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          data       JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await s`CREATE INDEX IF NOT EXISTS users_created_at_id_idx ON users (created_at ASC, id ASC)`;
      await s`
        CREATE TABLE IF NOT EXISTS app_config (
          key        TEXT PRIMARY KEY,
          value      JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      schemaPromise = null; // allow retry (e.g. transient offline)
      throw err;
    });
  }
  return schemaPromise;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type DbUser = { id: string; name: string; email: string };

export type UserRole = "superadmin" | "user";

/** Which systems a user may open; superadmin always has all. */
export type SystemPerms = {
  life: boolean;
  expense: boolean;
  business: boolean;
  salon: boolean;
  admin: boolean;
};

export const DEFAULT_PERMS: SystemPerms = {
  life: true,
  expense: true,
  business: true,
  salon: true,
  // Administrative oversight is opt-in. Only a superadmin gets it by default.
  admin: false,
};

export type DbUserFull = DbUser & {
  role: UserRole;
  permissions: SystemPerms;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, name, email FROM users WHERE email = ${email} LIMIT 1
  `;
  const row = rows[0] as DbUser | undefined;
  return row ?? null;
}

/** Full auth row (role + permissions) for sign-in. */
export async function getAuthRow(
  email: string,
): Promise<(DbUserFull & { password_hash: string }) | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, name, email, role, permissions, password_hash
    FROM users WHERE email = ${email} LIMIT 1
  `;
  const row = rows[0] as
    | (DbUserFull & { password_hash: string; permissions: SystemPerms | null })
    | undefined;
  if (!row) return null;
  return { ...row, permissions: row.permissions ?? DEFAULT_PERMS };
}

export async function countUsers(): Promise<number> {
  await ensureSchema();
  const rows = await getSql()`SELECT count(*)::int AS n FROM users`;
  return (rows[0] as { n: number }).n;
}

export type DbUserSummary = DbUserFull & {
  created_at: string;
  hasData: boolean;
};

export type UserPage = {
  users: DbUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Paginated account listing for admin screens. LIMIT/OFFSET runs in Postgres. */
export async function listUsersPage(
  page = 1,
  pageSize = 20,
): Promise<UserPage> {
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const requestedPage = Math.max(1, Math.floor(page));
  await ensureSchema();
  const offset = (requestedPage - 1) * safePageSize;
  const [rows, countRows] = await Promise.all([
    getSql()`
      SELECT u.id, u.name, u.email, u.role, u.permissions,
             u.created_at, (d.user_id IS NOT NULL) AS has_data
      FROM users u
      LEFT JOIN app_data d ON d.user_id = u.id
      ORDER BY u.created_at ASC, u.id ASC
      LIMIT ${safePageSize} OFFSET ${offset}
    `,
    getSql()`SELECT count(*)::int AS n FROM users`,
  ]);
  const total = Number((countRows[0] as { n: number }).n) || 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    users: (rows as (DbUserFull & {
      created_at: string;
      has_data: boolean;
      permissions: SystemPerms | null;
    })[]).map((r) => ({
      ...r,
      permissions: r.permissions ?? DEFAULT_PERMS,
      hasData: r.has_data,
    })),
    total,
    page: Math.min(requestedPage, totalPages),
    pageSize: safePageSize,
    totalPages,
  };
}

/** Backwards-compatible helper for callers that need the first page. */
export async function listUsers(): Promise<DbUserSummary[]> {
  return (await listUsersPage(1, 100)).users;
}

export async function setUserRole(id: string, role: UserRole): Promise<void> {
  await ensureSchema();
  await getSql()`UPDATE users SET role = ${role} WHERE id = ${id}`;
}

export async function setUserPermissions(
  id: string,
  permissions: SystemPerms,
): Promise<void> {
  await ensureSchema();
  await getSql()`
    UPDATE users SET permissions = ${JSON.stringify(permissions)}::jsonb
    WHERE id = ${id}
  `;
}

export async function updateUserProfile(
  id: string,
  name: string,
  email: string,
): Promise<void> {
  await ensureSchema();
  await getSql()`UPDATE users SET name = ${name}, email = ${email} WHERE id = ${id}`;
}

export async function resetUserPassword(
  id: string,
  passwordHash: string,
): Promise<void> {
  await ensureSchema();
  await getSql()`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id}`;
}

export async function deleteUser(id: string): Promise<void> {
  await ensureSchema();
  // app_data rows cascade (FK ON DELETE CASCADE)
  await getSql()`DELETE FROM users WHERE id = ${id}`;
}

/* ------------------------------------------------------------------ */
/* App config (dynamic modules etc.) — one JSONB row per key           */
/* ------------------------------------------------------------------ */

export async function getConfig(key: string): Promise<unknown | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT value FROM app_config WHERE key = ${key} LIMIT 1
  `;
  const row = rows[0] as { value: unknown } | undefined;
  return row ? row.value : null;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await getSql()`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function getUserHash(email: string): Promise<string | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT password_hash FROM users WHERE email = ${email} LIMIT 1
  `;
  const row = rows[0] as { password_hash: string } | undefined;
  return row ? row.password_hash : null;
}

export async function createUser(
  id: string,
  name: string,
  email: string,
  passwordHash: string,
  role: UserRole = "user",
  permissions?: SystemPerms,
): Promise<DbUser> {
  await ensureSchema();
  const rows = await getSql()`
    INSERT INTO users (id, name, email, password_hash, role, permissions)
    VALUES (${id}, ${name}, ${email}, ${passwordHash}, ${role},
            ${JSON.stringify(permissions ?? DEFAULT_PERMS)}::jsonb)
    RETURNING id, name, email
  `;
  return rows[0] as DbUser;
}

/* ------------------------------------------------------------------ */
/* Per-user app data (JSON document)                                   */
/* ------------------------------------------------------------------ */

export async function getAppData(userId: string): Promise<unknown | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT data FROM app_data WHERE user_id = ${userId} LIMIT 1
  `;
  const row = rows[0] as { data: unknown } | undefined;
  return row ? row.data : null;
}

export async function hasAppData(userId: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT 1 AS one FROM app_data WHERE user_id = ${userId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function saveAppData(userId: string, data: unknown): Promise<void> {
  await ensureSchema();
  await getSql()`
    INSERT INTO app_data (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (user_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}
