/**
 * Backend input validation.
 *
 * Flowday's static build talks to Neon directly from the browser, so the
 * functions in `db.ts` ARE the API boundary (there is no separate server
 * process — see docs/SECURITY.md for the eventual edge-proxy migration).
 * Every write path runs through these checks before a SQL statement is
 * built: malformed input never reaches the database, and callers receive a
 * stable error `code` they can map to an i18n key.
 *
 * Pure module: no imports, so both the db layer and the UI can use it, and
 * it stays trivially unit-testable.
 */

export type ValidationCode =
  | "email"
  | "password"
  | "name"
  | "id"
  | "role"
  | "permissions"
  | "exists"
  | "data"
  | "config";

/** Typed validation failure. `code` is stable and safe to switch on. */
export class ValidationError extends Error {
  readonly code: ValidationCode;
  readonly field: string;

  constructor(code: ValidationCode, field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.field = field;
  }
}

export function isValidationError(err: unknown): err is ValidationError {
  return err instanceof ValidationError;
}

/**
 * Stable code for the auth/UI layer: validation codes pass through, and the
 * plain-string errors thrown by the auth flow ("captcha", "invalid",
 * "exists") are recognized. Anything else returns null.
 */
export function authErrorCode(err: unknown): string | null {
  if (isValidationError(err)) return err.code;
  if (err instanceof Error && ["captcha", "invalid", "exists"].includes(err.message)) {
    return err.message;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

export const EMAIL_MAX = 254;
export const EMAIL_LOCAL_MAX = 64;
export const NAME_MAX = 80;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
/** Existing passwords are never length-checked beyond sanity (bcrypt). */
export const SIGNIN_PASSWORD_MAX = 1000;
export const USER_ID_MAX = 128;
/** Per-account JSON document cap — keeps one row from bloating the table. */
export const APP_DATA_MAX_BYTES = 4_000_000;
export const CONFIG_KEY_MAX = 64;
export const CONFIG_VALUE_MAX_BYTES = 1_000_000;

/**
 * Shape check only: no whitespace, exactly one "@", dotted domain with
 * non-empty labels. Unicode (Khmer) local parts/domains are allowed — the
 * goal is rejecting garbage, not enforcing RFC grammar.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
/** id: our uid() is base36 + "-_" — anything else never legitimately appears. */
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const CONFIG_KEY_RE = /^[A-Za-z0-9._-]{1,64}$/;
/** bcryptjs output: $2a$/$2b$/$2y$ + cost + 53-char body. */
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function fail(code: ValidationCode, field: string, message: string): never {
  throw new ValidationError(code, field, message);
}

/* ------------------------------------------------------------------ */
/* Field validators                                                    */
/* ------------------------------------------------------------------ */

/** Trim + lowercase + reject malformed. Returns the stored/lookup form. */
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") fail("email", "email", "Email must be a string");
  const email = value.trim().toLowerCase();
  if (!email) fail("email", "email", "Email is required");
  if (email.length > EMAIL_MAX) fail("email", "email", "Email is too long");
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) fail("email", "email", "Email is malformed");
  if (at > EMAIL_LOCAL_MAX) fail("email", "email", "Email local part is too long");
  if (!EMAIL_RE.test(email)) fail("email", "email", "Email is malformed");
  return email;
}

/** New/reset password policy. Returns the password unchanged (never trimmed). */
export function validateNewPassword(value: unknown): string {
  if (typeof value !== "string") fail("password", "password", "Password must be a string");
  if (value.length < PASSWORD_MIN) fail("password", "password", "Password is too short");
  if (value.length > PASSWORD_MAX) fail("password", "password", "Password is too long");
  return value;
}

/**
 * Sign-in password: existence/sanity only. Length rules must NOT run here —
 * an account created before the policy existed still has to be able to log in.
 */
export function validateSignInPassword(value: unknown): string {
  if (typeof value !== "string") fail("password", "password", "Password must be a string");
  if (!value) fail("password", "password", "Password is required");
  if (value.length > SIGNIN_PASSWORD_MAX) fail("password", "password", "Password is too long");
  return value;
}

/** Display name: trimmed, optional ("" is fine), length-capped. */
export function validateName(value: unknown): string {
  if (typeof value !== "string") fail("name", "name", "Name must be a string");
  const name = value.trim();
  if (name.length > NAME_MAX) fail("name", "name", "Name is too long");
  return name;
}

export function validateUserId(value: unknown): string {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    fail("id", "id", "Invalid user id");
  }
  return value;
}

export function validateRole(value: unknown): "superadmin" | "user" {
  if (value !== "superadmin" && value !== "user") fail("role", "role", "Invalid role");
  return value;
}

/**
 * Whitelist a permissions object to `allowedKeys`, coercing every value to a
 * strict boolean. Unknown keys are dropped (forward/backward compat when a
 * system is added or removed), missing keys default to false — the caller's
 * role logic (superadmin ⇒ all) runs afterwards.
 */
export function validatePermissions<T extends string>(
  value: unknown,
  allowedKeys: readonly T[],
): Record<T, boolean> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("permissions", "permissions", "Permissions must be an object");
  }
  const src = value as Record<string, unknown>;
  const out = {} as Record<T, boolean>;
  for (const key of allowedKeys) {
    const v = src[key];
    if (v === undefined) {
      out[key] = false;
    } else if (typeof v === "boolean") {
      out[key] = v;
    } else {
      fail("permissions", key, `Permission "${key}" must be true or false`);
    }
  }
  return out;
}

/** A stored password must already be a bcrypt hash, never plaintext. */
export function validateBcryptHash(value: unknown): string {
  if (typeof value !== "string" || !BCRYPT_RE.test(value)) {
    fail("password", "passwordHash", "Password hash must be a bcrypt hash");
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* JSON payloads                                                       */
/* ------------------------------------------------------------------ */

function safeStringify(value: unknown, maxBytes: number, code: ValidationCode): string {
  let json: string;
  try {
    json = JSON.stringify(value) ?? "null";
  } catch {
    fail(code, "data", "Value is not JSON-serializable");
  }
  // ~1 byte per char for the ASCII bulk of an app document; good enough for
  // a cap that exists to stop pathological payloads, not to meter exactly.
  if (json.length > maxBytes) fail(code, "data", "Value is too large");
  return json;
}

/**
 * Per-account document: must be a plain object (AppData), serializable and
 * under the size cap. Returns the JSON so db.ts does not stringify twice.
 */
export function validateAppData(userId: unknown, data: unknown): { userId: string; json: string } {
  const id = validateUserId(userId);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    fail("data", "data", "App data must be an object");
  }
  return { userId: id, json: safeStringify(data, APP_DATA_MAX_BYTES, "data") };
}

export function validateConfigKey(value: unknown): string {
  if (typeof value !== "string" || !CONFIG_KEY_RE.test(value)) {
    fail("config", "key", "Invalid config key");
  }
  return value;
}

export function validateConfigValue(value: unknown): string {
  return safeStringify(value, CONFIG_VALUE_MAX_BYTES, "config");
}
