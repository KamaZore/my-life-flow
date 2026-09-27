import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  updateSettings,
  useSettings,
  exportData,
  importData,
  resetDemoData,
  clearAllData,
  pushNow,
  useSyncState,
} from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useCurrency, money } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CloudUpload,
  Download,
  Languages,
  Moon,
  RefreshCw,
  Sun,
  SunMoon,
  Trash2,
  Upload,
  Monitor,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Shared settings page used by Life, Expense, Admin — and Business, which
 * injects its shop-specific card via `extra` so every system's settings
 * page keeps the same structure and style.
 */
export default function Settings({ extra }: { extra?: ReactNode } = {}) {
  const { t, lang, setLang } = useI18n();
  const settings = useSettings();
  const { mode, setMode } = useTheme();
  const { user, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const sync = useSyncState();
  const [name, setName] = useState(settings.name);
  const { currency, usdToKhr } = useCurrency();
  const [rateDraft, setRateDraft] = useState(String(usdToKhr));

  useEffect(() => {
    setRateDraft(String(usdToKhr));
  }, [usdToKhr]);

  const syncLabel = !isAuthenticated
    ? t("settings.syncState.local")
    : sync.syncing
      ? t("settings.syncState.syncing")
      : sync.error
        ? t("settings.syncState.error")
        : t("settings.syncState.saved");

  const doExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowday-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("common.saved"));
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(String(reader.result));
      if (ok) toast.success(t("common.saved"));
      else toast.error("Invalid backup file");
    };
    reader.readAsText(file);
  };

  const email = user?.email ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Profile */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-3 text-sm font-semibold">{t("settings.profile")}</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="name">{t("settings.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.namePlaceholder")}
              className="h-10 rounded-xl"
            />
          </div>
          <Button
            className="rounded-xl"
            onClick={() => {
              updateSettings({ name: name.trim() || "there" });
              toast.success(t("common.saved"));
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </section>

      {extra}

      {/* Language */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-3 flex items-center gap-2 text-sm font-semibold">
          <Languages className="size-4 text-primary" />
          {t("settings.language")}
        </h2>
        <p className="pb-3 text-xs text-muted-foreground">
          {t("settings.languageDesc")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "en" as const, label: "English" },
              { value: "km" as const, label: "ភាសាខ្មែរ" },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLang(opt.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                lang === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Currency */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-3 flex items-center gap-2 text-sm font-semibold">
          <Banknote className="size-4 text-primary" />
          {t("settings.currency")}
        </h2>
        <p className="pb-3 text-xs text-muted-foreground">{t("settings.currencyDesc")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "USD" as const, label: "USD ($)", sample: money(12.5) },
              { value: "KHR" as const, label: "KHR (៛)", sample: money(12.5) },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSettings({ currency: opt.value })}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                currency === opt.value
                  ? "border-primary bg-primary/10"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-muted-foreground">{opt.sample}</span>
            </button>
          ))}
        </div>
        {currency === "KHR" && (
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="fx-rate">{t("settings.exchangeRate")}</Label>
              <Input
                id="fx-rate"
                type="number"
                min="100"
                step="50"
                value={rateDraft}
                onChange={(e) => setRateDraft(e.target.value)}
                className="h-10 rounded-xl"
                inputMode="decimal"
              />
            </div>
            <Button
              className="rounded-xl"
              onClick={() => {
                const rate = Math.round(Number(rateDraft));
                if (!rate || rate < 100) return;
                updateSettings({ usdToKhr: rate });
                toast.success(t("common.saved"));
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        )}
        <p className="pt-2 text-[11px] text-muted-foreground">{t("settings.currencyNote")}</p>
      </section>

      {/* Appearance */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-3 text-sm font-semibold">{t("settings.appearance")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "light", label: t("theme.light"), icon: Sun },
              { value: "dark", label: t("theme.dark"), icon: Moon },
              { value: "system", label: t("theme.system"), icon: SunMoon },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                mode === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <opt.icon className="size-4" />
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("settings.weekMonday")}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings.weekMondayDesc")}
            </p>
          </div>
          <Switch
            checked={settings.weekStartsMonday}
            onCheckedChange={(v) => updateSettings({ weekStartsMonday: v })}
          />
        </div>
      </section>

      {/* Account */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-3 flex items-center gap-2 text-sm font-semibold">
          <UserRound className="size-4 text-primary" />
          {t("settings.account")}
        </h2>
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("settings.signedInAs")}</p>
              <p className="truncate text-xs text-muted-foreground">
                {email || user._id}
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 rounded-xl"
              onClick={async () => {
                toast.success(t("common.signOut"));
                // use-auth's signOut redirects to "/" itself; no extra
                // navigate needed (it caused a double navigation race).
                await signOut();
              }}
            >
              {t("settings.signOut")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t("settings.guestNote")}
            </p>
            <Button
              variant="outline"
              className="shrink-0 rounded-xl"
              onClick={() => navigate("/auth")}
            >
              {t("landing.ctaSignin")}
            </Button>
          </div>
        )}
      </section>

      {/* Data */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-1 text-sm font-semibold">{t("settings.data")}</h2>
        <p className="pb-3 text-xs text-muted-foreground">
          {t("settings.dataDesc")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl"
            disabled={!isAuthenticated || sync.syncing}
            onClick={async () => {
              const ok = await pushNow();
              if (ok) toast.success(t("settings.syncNowDone"));
              else toast.error(t("settings.syncState.error"));
            }}
          >
            <CloudUpload className="size-4" /> {t("settings.syncNow")}
            <span className="text-xs text-muted-foreground">· {syncLabel}</span>
          </Button>
          <Button variant="outline" className="gap-1.5 rounded-xl" onClick={doExport}>
            <Download className="size-4" /> {t("settings.export")}
          </Button>
          <label>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              <Upload className="size-4" /> {t("settings.import")}
            </span>
          </label>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl"
            onClick={() => {
              if (confirm(t("settings.resetDemo") + "?")) {
                resetDemoData();
                toast.success(t("common.saved"));
              }
            }}
          >
            <RefreshCw className="size-4" /> {t("settings.resetDemo")}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(t("settings.clearAll") + "?")) {
                clearAllData();
                toast.success(t("common.saved"));
              }
            }}
          >
            <Trash2 className="size-4" /> {t("settings.clearAll")}
          </Button>
        </div>
      </section>

      {/* About */}
      <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="pb-2 text-sm font-semibold">
          {t("settings.title")} · About
        </h2>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t("settings.about1")}</p>
          <p>{t("settings.about2")}</p>
          <p className="flex items-center gap-1.5">
            <Monitor className="size-3.5" />
            {t("settings.about3")}
          </p>
        </div>
      </section>
    </div>
  );
}
