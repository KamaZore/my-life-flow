import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { getAuthRow } from "@/lib/db";
import { authErrorCode, normalizeEmail } from "@/lib/validate";
import { rateCheck, rateClear, rateFail } from "@/lib/rate-limit";
import { trackSecurityEvent } from "@/lib/security";
import { readSaSession, writeSaSession } from "@/lib/superadmin";
import { uid } from "@/lib/store";
import bcrypt from "bcryptjs";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Private sign-in for the super admin (role = 'superadmin' in the users
 * table). Separate session from the normal app; lands on /superadmin/users.
 */
export default function SuperAdminLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in as super admin? Straight to the panel.
  useEffect(() => {
    if (readSaSession()) navigate("/superadmin/users", { replace: true });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const normalized = normalizeEmail(email);
      // Same backoff as the app sign-in: the admin door is throttled too.
      const gate = rateCheck(`sa:${normalized}`);
      if (!gate.ok) {
        trackSecurityEvent("sa_blocked", normalized);
        throw new Error("ratelimit");
      }
      const row = await getAuthRow(normalized);
      if (!row || row.role !== "superadmin") {
        rateFail(`sa:${normalized}`);
        trackSecurityEvent("sa_fail", normalized);
        throw new Error("forbidden");
      }
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) {
        rateFail(`sa:${normalized}`);
        trackSecurityEvent("sa_fail", normalized);
        throw new Error("invalid");
      }
      rateClear(`sa:${normalized}`);
      writeSaSession({
        token: uid() + uid(),
        userId: row.id,
        email: row.email,
        name: row.name,
      });
      toast.success(t("sa.welcome", { name: row.name || row.email }));
      navigate("/superadmin/users", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = authErrorCode(err);
      setError(
        msg === "forbidden"
          ? t("sa.notSuperAdmin")
          : msg === "invalid"
            ? t("auth.invalid")
            : code === "email"
              ? t("auth.emailInvalid")
              : code === "ratelimit"
                ? t("auth.errTooMany")
                : t("auth.dbError"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">{t("sa.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("sa.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="card-soft space-y-4 rounded-3xl border border-border/70 bg-card p-6">
          <div className="space-y-1.5">
            <Label htmlFor="sa-email">{t("auth.email")}</Label>
            <Input
              id="sa-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="owner@example.com"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-password">{t("auth.password")}</Label>
            <Input
              id="sa-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full gap-2 rounded-xl">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("sa.signIn")}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("sa.backToApp")}
          </Link>
        </div>
      </div>
    </main>
  );
}
