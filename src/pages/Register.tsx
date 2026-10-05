import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { TurnstileWidget, turnstileEnabled } from "@/components/app/Turnstile";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { hasDb } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { authErrorCode } from "@/lib/validate";

function resolveRedirect(returnTo: string | null, fallback = "/select-system") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

/**
 * Register page — creates a real account (email + bcrypt password) in the
 * app's own Neon Postgres database. Each account keeps its own isolated
 * dataset locally and syncs to its own `app_data` row.
 */
function RegisterInner() {
  const { t } = useI18n();
  const { isAuthenticated, isLoading, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const redirect = resolveRedirect(returnTo);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);

  // Already signed in (e.g. revisiting /register) → straight to the app.
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(redirect, { replace: true });
  }, [isLoading, isAuthenticated, navigate, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    // Cloudflare Turnstile: when the site key is configured, a fresh token
    // must exist before the registration request is allowed through.
    if (turnstileEnabled() && !tsToken) {
      setError(t("auth.verifyHuman"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordHint"));
      return;
    }
    setBusy(true);
    try {
      await signUp(name, email, password, tsToken);
      // Auth state flip navigates via the effect above.
    } catch (err) {
      // Server-side validation codes (validate.ts) → translated messages.
      const code = authErrorCode(err);
      setError(
        code === "captcha"
          ? t("auth.errCaptcha")
          : code === "ratelimit"
            ? t("auth.errTooMany")
            : code === "email"
            ? t("auth.emailInvalid")
            : code === "password"
              ? t("auth.errPassword")
              : code === "name"
                ? t("auth.errName")
                : code === "exists"
                  ? t("auth.errExists")
                  : t("auth.errGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="safe-top safe-bottom relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <OfflineBanner messageKey="offline.bannerAuth" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-primary/10 blur-3xl"
      />
      <button
        onClick={() => navigate("/")}
        className="relative mb-6 flex items-center gap-2"
      >
        <svg viewBox="0 0 512 512" className="size-10 text-primary" aria-hidden>
          <rect width="512" height="512" rx="112" fill="currentColor" />
          <path d="M150 176 L236 256 L150 336" stroke="#fff" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
          <path d="M250 176 L336 256 L250 336" stroke="#fff" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
          <path d="M350 176 L436 256 L350 336" stroke="#fff" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="text-xl font-bold">Flowday</span>
      </button>

      {!hasDb && (
        <p className="relative mb-4 w-full max-w-sm rounded-xl bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
          {t("auth.dbMissing")}
        </p>
      )}

      <div className="card-soft relative w-full max-w-sm rounded-3xl border border-border/70 bg-card p-6">
        <h1 className="text-xl font-bold tracking-tight">
          {t("auth.registerTitle")}
        </h1>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
              className="h-10 rounded-xl"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="h-10 rounded-xl"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-xl pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <TurnstileWidget onToken={setTsToken} />

          <Button type="submit" className="h-10 w-full rounded-xl" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("auth.creating")}
              </>
            ) : (
              t("auth.createBtn")
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <button
            onClick={() =>
              navigate(
                returnTo
                  ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
                  : "/auth",
              )
            }
            className="font-semibold text-primary hover:underline"
          >
            {t("auth.goSignin")}
          </button>
        </p>
      </div>

      <p className="relative mt-4 text-center text-xs text-muted-foreground">
        {t("auth.localNote")}
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return <RegisterInner />;
}
