import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/systems/ImagePicker";
import { IosSpinner } from "@/components/ui/IosSpinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import {
  deleteUser,
  getAppData,
  getAuthRow,
  listAppErrors,
  listAuthEvents,
  listUsersPage,
  resetUserPassword,
  setUserPermissions,
  setUserRole,
  updateUserProfile,
  createUser,
  DEFAULT_PERMS,
  type AppError,
  type AppErrorSource,
  type AuthEvent,
  type AuthEventType,
  type SystemPerms,
  type UserRole,
} from "@/lib/db";
import {
  ACCENTS,
  defaultModules,
  ICONS,
  loadModules,
  saveModules,
  useModules,
  type AppModule,
} from "@/lib/modules";
import { readSaSession, refreshSaSession, saSessionNeedsRefresh, writeSaSession } from "@/lib/superadmin";
import {
  defaultHealthDeps,
  overallHealth,
  runHealthChecks,
  type HealthCheck,
  type HealthId,
} from "@/lib/monitor";
import {
  authErrorCode,
  validateNewPassword,
  PASSWORD_MIN,
} from "@/lib/validate";
import {
  defaultSiteContent,
  loadSiteContent,
  saveSiteContent,
  type SiteContent,
} from "@/lib/site-content";
import bcrypt from "bcryptjs";
import { uid } from "@/lib/store";
import {
  Database,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  ArrowDown,
  ArrowUp,
  Blocks,
  BarChart3,
  Activity,
  ExternalLink,
  Sparkles,
  MapPin,
  Radio,
  Server,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type PanelUser = Awaited<ReturnType<typeof listUsersPage>>["users"][number];
const USERS_PER_PAGE = 20;

const SYSTEMS: { key: keyof SystemPerms; labelKey: string }[] = [
  { key: "life", labelKey: "system.life.name" },
  { key: "expense", labelKey: "system.expense.name" },
  { key: "business", labelKey: "system.business.name" },
  { key: "salon", labelKey: "system.salon.name" },
  { key: "admin", labelKey: "system.admin.name" },
];

/** Counts records inside a user's data doc per system. */
/** Timestamp as a readable local string for the usage row. */
function formatStamp(at: number) {
  const d = new Date(at);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Badge style + i18n key per security event type (attack log). */
const SEC_TYPE: Record<AuthEventType, { key: string; cls: string }> = {
  signin_fail: { key: "sa.t.signinFail", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  signin_blocked: { key: "sa.t.signinBlocked", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  signup_exists: { key: "sa.t.signupExists", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  sa_fail: { key: "sa.t.saFail", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  sa_blocked: { key: "sa.t.saBlocked", cls: "bg-red-600/20 text-red-700 dark:text-red-400" },
};

/** Icon + i18n key per health check (monitoring tab). */
const HEALTH_ICON: Record<HealthId, typeof Server> = {
  site: Server,
  database: Database,
  telegram: Radio,
  ip: MapPin,
};
const HEALTH_LABEL: Record<HealthId, string> = {
  site: "sa.h.site",
  database: "sa.h.db",
  telegram: "sa.h.telegram",
  ip: "sa.h.ip",
};

/** Badge style + i18n key per website error source. */
const ERR_SRC: Record<AppErrorSource, { key: string; cls: string }> = {
  global: { key: "sa.src.global", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  rejection: { key: "sa.src.rejection", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  boundary: { key: "sa.src.boundary", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
};

/** Localized probe note; falls back to the raw code (e.g. "http_503"). */
function noteText(t: (key: string) => string, note: string): string {
  const key = `sa.h.note.${note}`;
  const s = t(key);
  return s === key ? note.replace(/_/g, " ") : s;
}

function summarize(d: unknown): {
  life: number;
  expense: number;
  business: number;
  salon: number;
  views: number;
  lastSeen: number;
  lastLogin: number;
} | null {
  if (!d || typeof d !== "object") return null;
  const doc = d as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  const biz = doc.business as Record<string, unknown> | undefined;
  const sl = doc.salon as Record<string, unknown> | undefined;
  // Usage log: stored newest-first, so the head is the most recent event.
  const act = Array.isArray(doc.activity)
    ? (doc.activity as { type?: string; at?: number }[])
    : [];
  const stamp = (v: unknown) => (typeof v === "number" && v > 0 ? v : 0);
  return {
    life: arr(doc.tasks) + arr(doc.habits) + arr(doc.projects) + arr(doc.notes),
    expense: arr(doc.transactions) + arr(doc.accounts) + arr(doc.debts),
    business: biz
      ? arr(biz.products) + arr(biz.orders) + arr(biz.customers) + arr(biz.expenses)
      : 0,
    salon: sl
      ? arr(sl.appointments) + arr(sl.customers) + arr(sl.services) + arr(sl.staff)
      : 0,
    views: act.filter((a) => a?.type === "module").length,
    lastSeen: stamp(act[0]?.at),
    lastLogin: stamp(act.find((a) => a?.type === "login")?.at),
  };
}

export default function SuperAdminPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<PanelUser | null>(null);
  const [dataFor, setDataFor] = useState<PanelUser | null>(null);
  const [dataSummary, setDataSummary] = useState<ReturnType<typeof summarize>>(null);
  const [dataBusy, setDataBusy] = useState(false);
  const [modules, setModules] = useState<AppModule[]>([]);
  const [modulesBusy, setModulesBusy] = useState(false);
  const [moduleEdit, setModuleEdit] = useState<AppModule | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [moduleNameKm, setModuleNameKm] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [moduleDescKm, setModuleDescKm] = useState("");
  const [modulePath, setModulePath] = useState("");
  const [moduleIcon, setModuleIcon] = useState("sparkles");
  const [moduleAccent, setModuleAccent] = useState(ACCENTS[0]);
  const [siteDraft, setSiteDraft] = useState<SiteContent>(defaultSiteContent);
  const [siteBusy, setSiteBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<"users" | "site" | "modules" | "security" | "monitor">("users");
  // Security section: failed / blocked sign-in attempts (auth_events table).
  const [secEvents, setSecEvents] = useState<AuthEvent[]>([]);
  const [secBusy, setSecBusy] = useState(false);
  const [secNonce, setSecNonce] = useState(0);
  // Monitoring section: service health probes + website error log.
  const [monChecks, setMonChecks] = useState<HealthCheck[] | null>(null);
  const [monBusy, setMonBusy] = useState(false);
  const [monNonce, setMonNonce] = useState(0);
  const [appErrs, setAppErrs] = useState<AppError[]>([]);
  const [errBusy, setErrBusy] = useState(false);

  const visibleUsers = users.length;
  const visibleAdmins = users.filter((u) => u.role === "superadmin").length;
  const visibleStandardUsers = visibleUsers - visibleAdmins;
  const enabledModules = modules.filter((m) => m.enabled).length;
  const usersWithData = users.filter((u) => u.hasData).length;

  // create form
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPassword, setNPassword] = useState("");
  const [nPerms, setNPerms] = useState<SystemPerms>({ ...DEFAULT_PERMS });
  const [nBusy, setNBusy] = useState(false);

  // edit form
  const [eName, setEName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePerms, setEPerms] = useState<SystemPerms>({ ...DEFAULT_PERMS });
  const [newPassword, setNewPassword] = useState("");
  const [eBusy, setEBusy] = useState(false);

  // Load the attack log when its tab opens (and on manual refresh).
  useEffect(() => {
    if (activeSection !== "security") return;
    let cancelled = false;
    setSecBusy(true);
    listAuthEvents(100)
      .then((events) => {
        if (!cancelled) setSecEvents(events);
      })
      .catch(() => {
        if (!cancelled) setSecEvents([]);
      })
      .finally(() => {
        if (!cancelled) setSecBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, secNonce]);

  // Monitoring: probe service health + load the error log when the tab opens
  // (health re-probes every 60s while the tab is visible).
  useEffect(() => {
    if (activeSection !== "monitor") return;
    let cancelled = false;
    setMonBusy(true);
    setErrBusy(true);
    runHealthChecks(defaultHealthDeps())
      .then((checks) => {
        if (!cancelled) setMonChecks(checks);
      })
      .catch(() => {
        if (!cancelled) setMonChecks(null);
      })
      .finally(() => {
        if (!cancelled) setMonBusy(false);
      });
    listAppErrors(100)
      .then((errors) => {
        if (!cancelled) setAppErrs(errors);
      })
      .catch(() => {
        if (!cancelled) setAppErrs([]);
      })
      .finally(() => {
        if (!cancelled) setErrBusy(false);
      });
    const timer = window.setInterval(() => {
      runHealthChecks(defaultHealthDeps())
        .then((checks) => {
          if (!cancelled) setMonChecks(checks);
        })
        .catch(() => {
          // Keep the last result — a failed refresh is not a outage signal.
        });
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSection, monNonce]);

  const refresh = useCallback(async (requestedPage = page) => {
    setLoading(true);
    try {
      const result = await listUsersPage(requestedPage, USERS_PER_PAGE);
      setUsers(result.users);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      toast.error(t("sa.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    const session = readSaSession();
    if (!session) {
      navigate("/superadmin", { replace: true });
      return;
    }
    // Re-check the database role on every panel visit. The local session is
    // only a convenience; it is never treated as authorization by itself.
    void getAuthRow(session.email).then((row) => {
      if (!row || row.id !== session.userId || row.role !== "superadmin") {
        writeSaSession(null);
        navigate("/superadmin", { replace: true });
        return;
      }
      // Sliding session: rotate a stale panel token now that the role has
      // been re-validated against the database.
      if (saSessionNeedsRefresh(session)) refreshSaSession(session);
      void refresh(1);
      void loadModules().then(setModules);
      void loadSiteContent().then((loadedContent) => setSiteDraft(loadedContent));
    }).catch(() => {
      writeSaSession(null);
      navigate("/superadmin", { replace: true });
    });
  }, [navigate, refresh]);

  async function persistSiteContent() {
    setSiteBusy(true);
    try {
      await saveSiteContent(siteDraft);
      toast.success(t("sa.siteContentSaved"));
    } catch {
      toast.error(t("sa.siteContentFailed"));
    } finally {
      setSiteBusy(false);
    }
  }

  function updateSiteSlide(index: number, patch: Partial<SiteContent["slides"][number]>) {
    setSiteDraft((current) => ({
      ...current,
      slides: current.slides.map((slide, i) => i === index ? { ...slide, ...patch } : slide),
    }));
  }

  function addSiteSlide() {
    setSiteDraft((current) => ({
      ...current,
      slides: [...current.slides, {
        id: `slide-${Date.now()}`,
        title: "New slide",
        titleKm: "ស្លាកថ្មី",
        subtitle: "Add a short description",
        subtitleKm: "បន្ថែមការពិពណ៌នាសង្ខេប",
        imageUrl: "",
        enabled: true,
      }],
    }));
  }

  async function persistModules(next: AppModule[]) {
    setModulesBusy(true);
    try {
      setModules(next);
      await saveModules(next);
      toast.success(t("sa.modulesSaved"));
    } catch {
      toast.error(t("sa.modulesFailed"));
    } finally {
      setModulesBusy(false);
    }
  }

  function openModule(m: AppModule) {
    setModuleEdit(m);
    setModuleName(m.name ?? "");
    setModuleNameKm(m.nameKm ?? "");
    setModuleDesc(m.desc ?? "");
    setModuleDescKm(m.descKm ?? "");
    setModulePath(m.path ?? "");
    setModuleIcon(m.icon);
    setModuleAccent(m.accent);
  }

  function saveModule() {
    if (!moduleEdit || !moduleName.trim()) return;
    const next: AppModule = {
      ...moduleEdit,
      name: moduleName.trim(),
      nameKm: moduleNameKm.trim() || undefined,
      desc: moduleDesc.trim() || undefined,
      descKm: moduleDescKm.trim() || undefined,
      path: modulePath.trim() || undefined,
      icon: moduleIcon,
      accent: moduleAccent,
    };
    void persistModules(modules.map((m) => m.id === next.id ? next : m));
    setModuleEdit(null);
  }

  function addModule() {
    const next: AppModule = {
      id: `m-${uid()}`,
      name: "New module",
      nameKm: "ម៉ូឌុលថ្មី",
      desc: "A new Flowday workspace",
      descKm: "កម្មវិធីថ្មី",
      icon: "sparkles",
      accent: ACCENTS[modules.length % ACCENTS.length],
      path: "#/select-system",
      enabled: true,
      order: modules.length,
      custom: true,
    };
    void persistModules([...modules, next]);
    openModule(next);
  }

  function moveModule(id: string, direction: -1 | 1) {
    const ordered = [...modules].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((m) => m.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void persistModules(ordered.map((m, i) => ({ ...m, order: i })));
  }

  async function openData(u: PanelUser) {
    setDataFor(u);
    setDataSummary(null);
    setDataBusy(true);
    try {
      const doc = await getAppData(u.id);
      setDataSummary(summarize(doc));
    } catch {
      setDataSummary(null);
    } finally {
      setDataBusy(false);
    }
  }

  /** Map a thrown backend error to a translated toast message. */
  function errMsg(err: unknown, fallback: string): string {
    const code = authErrorCode(err);
    if (code === "email") return t("auth.emailInvalid");
    if (code === "password") return t("auth.errPassword");
    if (code === "name") return t("auth.errName");
    if (code === "exists") return t("auth.errExists");
    return fallback;
  }

  async function createAccount() {
    setNBusy(true);
    try {
      // Same policy the register flow enforces — fails fast with a typed
      // code instead of writing a weak/invalid account.
      validateNewPassword(nPassword);
      const email = nEmail.trim().toLowerCase();
      const hash = await bcrypt.hash(nPassword, 10);
      await createUser(uid() + uid(), nName.trim(), email, hash, "user", nPerms);
      toast.success(t("sa.created"));
      setCreateOpen(false);
      setNName("");
      setNEmail("");
      setNPassword("");
      setNPerms({ ...DEFAULT_PERMS });
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, t("sa.createFailed")));
    } finally {
      setNBusy(false);
    }
  }

  async function saveEdit() {
    if (!editFor) return;
    setEBusy(true);
    try {
      await updateUserProfile(editFor.id, eName.trim(), eEmail.trim().toLowerCase());
      await setUserRole(editFor.id, editFor.role);
      await setUserPermissions(editFor.id, ePerms);
      if (newPassword) {
        validateNewPassword(newPassword);
        const hash = await bcrypt.hash(newPassword, 10);
        await resetUserPassword(editFor.id, hash);
      }
      toast.success(t("sa.saved"));
      setEditFor(null);
      setNewPassword("");
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, t("sa.saveFailed")));
    } finally {
      setEBusy(false);
    }
  }

  async function toggleRole(u: PanelUser) {
    try {
      const next: UserRole = u.role === "superadmin" ? "user" : "superadmin";
      await setUserRole(u.id, next);
      await refresh();
      toast.success(t("sa.saved"));
    } catch (err) {
      toast.error(errMsg(err, t("sa.saveFailed")));
    }
  }

  async function remove(u: PanelUser) {
    if (!confirm(t("sa.deleteConfirm", { email: u.email }))) return;
    try {
      await deleteUser(u.id);
      toast.success(t("sa.deleted"));
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, t("sa.saveFailed")));
    }
  }

  function openEdit(u: PanelUser) {
    setEditFor(u);
    setEName(u.name);
    setEEmail(u.email);
    setEPerms({ ...u.permissions });
    setNewPassword("");
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("sa.panel")}</h1>
              <p className="text-xs text-muted-foreground">{t("sa.panelSub")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh(page)} className="gap-1.5 rounded-lg">
              <RefreshCw className={"size-3.5" + (loading ? " animate-spin" : "")} />
              {t("common.refresh") ?? "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => {
                writeSaSession(null);
                navigate("/superadmin", { replace: true });
              }}
            >
              {t("common.signOut")}
            </Button>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card p-2" aria-label={t("sa.controlCenter")}>
          {([
            ["users", t("sa.menuUsers"), Users],
            ["site", t("sa.menuSiteContent"), Sparkles],
            ["modules", t("sa.menuModules"), Blocks],
            ["security", t("sa.menuSecurity"), ShieldAlert],
            ["monitor", t("sa.menuMonitor"), Activity],
          ] as const).map(([id, label, Icon]) => (
            <Button
              key={id}
              type="button"
              variant={activeSection === id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection(id)}
              className="flex-1 gap-1.5"
            >
              <Icon className="size-3.5" /> {label}
            </Button>
          ))}
        </nav>

        {activeSection === "users" && (
        <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <Users className="mr-1 inline size-4" />
            {t("sa.count", { n: total })}
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl">
            <UserPlus className="size-4" />
            {t("sa.createUser")}
          </Button>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-soft rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("sa.count", { n: total })}</span><Users className="size-4 text-primary" /></div>
            <p className="mt-2 text-2xl font-extrabold">{total}</p>
            <p className="text-[11px] text-muted-foreground">{t("sa.users")}</p>
          </div>
          <div className="card-soft rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("sa.roleUser")}</span><Activity className="size-4 text-emerald-500" /></div>
            <p className="mt-2 text-2xl font-extrabold">{visibleStandardUsers}</p>
            <p className="text-[11px] text-muted-foreground">{t("sa.visiblePage")}</p>
          </div>
          <div className="card-soft rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("sa.roleSuper")}</span><ShieldCheck className="size-4 text-amber-500" /></div>
            <p className="mt-2 text-2xl font-extrabold">{visibleAdmins}</p>
            <p className="text-[11px] text-muted-foreground">{t("sa.visiblePage")}</p>
          </div>
          <div className="card-soft rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("sa.modules")}</span><BarChart3 className="size-4 text-violet-500" /></div>
            <p className="mt-2 text-2xl font-extrabold">{enabledModules}</p>
            <p className="text-[11px] text-muted-foreground">{usersWithData} {t("sa.withData")}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-primary/15 bg-primary/[.04] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Database className="size-4" /></span>
            <div>
              <h2 className="text-sm font-bold">{t("sa.systemInfoTitle")}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("sa.systemInfoText")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {SYSTEMS.map((system) => (
                  <div key={system.key} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                    <p className="truncate text-[11px] font-semibold">{t(system.labelKey)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{users.filter((u) => u.role === "superadmin" || u.permissions[system.key]).length} {t("sa.users")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* User list */}
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="card-soft flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-4"
            >
              <span
                className={
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                  (u.role === "superadmin"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-primary/10 text-primary")
                }
              >
                {u.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      (u.role === "superadmin"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {u.role === "superadmin" ? t("sa.roleSuper") : t("sa.roleUser")}
                  </span>
                  {!u.hasData && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {t("sa.noData")}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {SYSTEMS.map((s) =>
                    u.role === "superadmin" || u.permissions[s.key] ? (
                      <span key={s.key} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {t(s.labelKey)}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => openData(u)} aria-label={t("sa.viewData")}>
                  <Database className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => openEdit(u)} aria-label={t("common.edit")}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-lg text-destructive" onClick={() => remove(u)} aria-label={t("common.delete")}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {loading && (
            <IosSpinner label={t("sa.loading")} className="py-10" />
          )}
          {!loading && users.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
              <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("sa.empty")}</p>
            </div>
          )}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => void refresh(page - 1)}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => void refresh(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
        </div>
        )}

        {activeSection === "site" && (
        <div className="space-y-5">
        {/* Public site content */}
        <section className="space-y-4 rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="size-4 text-primary" />{t("sa.siteContent")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("sa.siteContentSub")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void persistSiteContent()} disabled={siteBusy} className="gap-1.5">{siteBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{t("sa.saveSiteContent")}</Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 text-xs font-semibold">
              Logo
              <div className="flex flex-wrap items-center gap-2">
                <ImagePicker value={siteDraft.logoUrl} onChange={(value) => setSiteDraft({ ...siteDraft, logoUrl: value ?? "" })} size="sm" />
                <input value={siteDraft.logoUrl} onChange={(e) => setSiteDraft({ ...siteDraft, logoUrl: e.target.value })} placeholder="https://..." className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm font-normal" />
              </div>
            </div>
            <label className="space-y-1.5 text-xs font-semibold">Website name (EN)<input value={siteDraft.siteName} onChange={(e) => setSiteDraft({ ...siteDraft, siteName: e.target.value })} className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
            <label className="space-y-1.5 text-xs font-semibold">Website name (ភាសាខ្មែរ)<input value={siteDraft.siteNameKm} onChange={(e) => setSiteDraft({ ...siteDraft, siteNameKm: e.target.value })} className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
            <label className="space-y-1.5 text-xs font-semibold">Header title (EN)<input value={siteDraft.headerTitle} onChange={(e) => setSiteDraft({ ...siteDraft, headerTitle: e.target.value })} className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
            <label className="space-y-1.5 text-xs font-semibold">Header title (ភាសាខ្មែរ)<input value={siteDraft.headerTitleKm} onChange={(e) => setSiteDraft({ ...siteDraft, headerTitleKm: e.target.value })} className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
            <label className="space-y-1.5 text-xs font-semibold">Header subtitle (EN)<textarea value={siteDraft.headerSubtitle} onChange={(e) => setSiteDraft({ ...siteDraft, headerSubtitle: e.target.value })} className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal" /></label>
            <label className="space-y-1.5 text-xs font-semibold">Header subtitle (ភាសាខ្មែរ)<textarea value={siteDraft.headerSubtitleKm} onChange={(e) => setSiteDraft({ ...siteDraft, headerSubtitleKm: e.target.value })} className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal" /></label>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sa.cardImages")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("sa.cardImageHint")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={addSiteSlide} className="gap-1.5"><Plus className="size-3.5" />{t("sa.addSlide")}</Button>
            </div>
            {siteDraft.slides.map((slide, index) => (
              <div key={slide.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-background/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{t("sa.carouselCard", { n: index + 1 })}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("sa.cardImageOnlyHint")}</p>
                </div>
                <ImagePicker value={slide.imageUrl} onChange={(value) => updateSiteSlide(index, { imageUrl: value ?? "" })} size="md" />
                <div className="flex items-center gap-2">
                  <Switch checked={slide.enabled} onCheckedChange={(enabled) => updateSiteSlide(index, { enabled })} aria-label={t("sa.cardEnabled")} />
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setSiteDraft({ ...siteDraft, slides: siteDraft.slides.filter((_, i) => i !== index) })} aria-label={t("common.delete")}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("sa.siteContentHint")}</p>
        </section>
        </div>
        )}

        {activeSection === "modules" && (
        <div className="space-y-5">
        {/* Module management */}
        <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Blocks className="size-4 text-primary" />
                {t("sa.modules")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("sa.modulesSub")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={addModule} disabled={modulesBusy} className="gap-1.5 rounded-lg">
              <Plus className="size-3.5" /> {t("sa.addModule")}
            </Button>
          </div>
          <div className="space-y-2">
            {[...modules].sort((a, b) => a.order - b.order).map((m, i, ordered) => {
              const Icon = ICONS[m.icon] ?? ICONS.sparkles;
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/60 p-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className={`size-4 ${m.accent}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.labelKey ? t(m.labelKey) : (m.name ?? m.id)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.custom ? m.path || "No destination" : `Built-in · ${m.builtin}`}</p>
                  </div>
                  <Switch checked={m.enabled} onCheckedChange={(enabled) => void persistModules(modules.map((x) => x.id === m.id ? { ...x, enabled } : x))} />
                  <Button variant="ghost" size="icon" className="size-8" disabled={i === 0 || modulesBusy} onClick={() => moveModule(m.id, -1)} aria-label={t("sa.moveUp")}><ArrowUp className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8" disabled={i === ordered.length - 1 || modulesBusy} onClick={() => moveModule(m.id, 1)} aria-label={t("sa.moveDown")}><ArrowDown className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => openModule(m)} aria-label={t("common.edit")}><Pencil className="size-3.5" /></Button>
                  {m.custom && <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void persistModules(modules.filter((x) => x.id !== m.id))} aria-label={t("common.delete")}><Trash2 className="size-3.5" /></Button>}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("sa.modulesSecurityNote")}</p>
        </section>
        </div>
        )}

        {activeSection === "security" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-red-500/20 bg-red-500/[.04] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600"><ShieldAlert className="size-4" /></span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{t("sa.secTitle")}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("sa.secSub")}</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSecNonce((n) => n + 1)} disabled={secBusy} className="gap-1.5 rounded-lg">
              <RefreshCw className={"size-3.5" + (secBusy ? " animate-spin" : "")} />
              {t("common.refresh") ?? "Refresh"}
            </Button>
          </div>

          {secBusy && <IosSpinner label={t("sa.loading")} className="py-10" />}

          {!secBusy && secEvents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
              <ShieldAlert className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("sa.secEmpty")}</p>
            </div>
          )}

          {!secBusy && secEvents.length > 0 && (
            <div className="space-y-2">
              {secEvents.map((e) => (
                <div key={e.id} className="card-soft flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border/60 bg-card px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEC_TYPE[e.type]?.cls ?? "bg-muted text-muted-foreground"}`}>
                    {t(SEC_TYPE[e.type]?.key ?? "sa.menuSecurity")}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{e.email ?? "—"}</p>
                  <p className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{e.ip ?? "—"}</p>
                  <p className="max-w-[45%] truncate text-[10px] text-muted-foreground" title={e.details ?? e.device ?? undefined}>{e.device ?? "—"}</p>
                  <p className="text-[10px] tabular-nums text-muted-foreground">{formatStamp(e.at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {activeSection === "monitor" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[.04] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600"><Activity className="size-4" /></span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{t("sa.monTitle")}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("sa.monSub")}</p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-2">
            {monChecks ? (
              (() => {
                const overall = overallHealth(monChecks);
                const cls = overall === "ok"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : overall === "degraded"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400";
                const label = overall === "ok" ? t("sa.h.ok") : overall === "degraded" ? t("sa.h.degraded") : t("sa.h.down");
                return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
              })()
            ) : (
              <span className="text-xs text-muted-foreground">{monBusy ? t("sa.h.checking") : ""}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => setMonNonce((n) => n + 1)} disabled={monBusy} className="gap-1.5 rounded-lg">
              <RefreshCw className={"size-3.5" + (monBusy ? " animate-spin" : "")} />
              {t("common.refresh")}
            </Button>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(monChecks ?? []).map((c) => {
              const Icon = HEALTH_ICON[c.id];
              return (
                <div key={c.id} className="card-soft rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className={`flex size-7 items-center justify-center rounded-lg ${c.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className={`size-2 rounded-full ${c.ok ? "bg-emerald-500" : "bg-red-500"}`} aria-label={c.ok ? t("sa.h.ok") : t("sa.h.down")} />
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold">{t(HEALTH_LABEL[c.id])}</p>
                  <p className="mt-1 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
                    <span className="shrink-0">{c.ms} ms</span>
                    {c.note && <span className="truncate" title={c.note}>{noteText(t, c.note)}</span>}
                  </p>
                </div>
              );
            })}
            {monBusy && !monChecks && (
              <div className="col-span-full"><IosSpinner label={t("sa.h.checking")} className="py-6" /></div>
            )}
          </section>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">{t("sa.errTitle")}</h3>
            {appErrs.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">{appErrs.length}</span>
            )}
          </div>

          {errBusy && <IosSpinner label={t("sa.loading")} className="py-6" />}

          {!errBusy && appErrs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
              <Activity className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("sa.errEmpty")}</p>
            </div>
          )}

          {!errBusy && appErrs.length > 0 && (
            <div className="space-y-2">
              {appErrs.map((e) => (
                <div key={e.id} className="card-soft flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border/60 bg-card px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ERR_SRC[e.source]?.cls ?? "bg-muted text-muted-foreground"}`}>
                    {t(ERR_SRC[e.source]?.key ?? "sa.src.global")}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium" title={e.message}>{e.message}</p>
                  <p className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">×{e.hits}</p>
                  <p className="max-w-[45%] truncate text-[10px] text-muted-foreground" title={e.page ?? undefined}>{e.page ?? "—"}</p>
                  <p className="text-[10px] tabular-nums text-muted-foreground">{formatStamp(e.at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="text-center">
          <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("sa.backToApp")}
          </Link>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              {t("sa.createUser")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">{t("settings.name")}</Label>
              <Input id="nu-name" value={nName} onChange={(e) => setNName(e.target.value)} className="h-10 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">{t("auth.email")}</Label>
              <Input id="nu-email" type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">{t("auth.password")}</Label>
              <Input id="nu-pass" type="password" value={nPassword} onChange={(e) => setNPassword(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sa.systemAccess")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SYSTEMS.map((s) => (
                  <label key={s.key} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium">
                    {t(s.labelKey)}
                    <Switch checked={nPerms[s.key]} onCheckedChange={(v) => setNPerms({ ...nPerms, [s.key]: v })} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={createAccount}
              disabled={nBusy || !nName.trim() || !nEmail.trim() || nPassword.length < PASSWORD_MIN}
              className="gap-2 rounded-xl"
            >
              {nBusy && <Loader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editFor} onOpenChange={(v) => !v && setEditFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              {t("sa.editUser")}
            </DialogTitle>
          </DialogHeader>
          {editFor && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="eu-name">{t("settings.name")}</Label>
                <Input id="eu-name" value={eName} onChange={(e) => setEName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-email">{t("auth.email")}</Label>
                <Input id="eu-email" type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                <span className="text-sm font-medium">{t("sa.makeSuper")}</span>
                <Switch checked={editFor.role === "superadmin"} onCheckedChange={() => toggleRole(editFor)} />
              </label>
              <div className="space-y-1.5">
                <Label>{t("sa.systemAccess")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEMS.map((s) => (
                    <label key={s.key} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium">
                      {t(s.labelKey)}
                      <Switch
                        checked={editFor.role === "superadmin" || ePerms[s.key]}
                        disabled={editFor.role === "superadmin"}
                        onCheckedChange={(v) => setEPerms({ ...ePerms, [s.key]: v })}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-pass">{t("sa.resetPass")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="eu-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="••••••••"
                  />
                  <KeyRound className="mt-3 size-4 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground">{t("sa.resetPassHint")}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditFor(null)} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={eBusy || !eName.trim() || !eEmail.trim()} className="gap-2 rounded-xl">
              {eBusy && <Loader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module editor */}
      <Dialog open={!!moduleEdit} onOpenChange={(v) => !v && setModuleEdit(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="size-4 text-primary" />{t("sa.editModule")}</DialogTitle>
          </DialogHeader>
          {moduleEdit && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>English name</Label><Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>ភាសាខ្មែរ</Label><Input value={moduleNameKm} onChange={(e) => setModuleNameKm(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Description</Label><Input value={moduleDesc} onChange={(e) => setModuleDesc(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>ការពិពណ៌នា</Label><Input value={moduleDescKm} onChange={(e) => setModuleDescKm(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Destination</Label><Input value={modulePath} onChange={(e) => setModulePath(e.target.value)} placeholder="#/life/today or https://…" /><p className="text-[11px] text-muted-foreground">Hash paths and external links are supported. This is a link, not a data-sharing grant.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Icon</Label><select value={moduleIcon} onChange={(e) => setModuleIcon(e.target.value)} className="h-10 w-full rounded-xl border bg-background px-3 text-sm">{Object.keys(ICONS).map((key) => <option key={key} value={key}>{key}</option>)}</select></div>
              <div className="space-y-1.5"><Label>Accent</Label><select value={moduleAccent} onChange={(e) => setModuleAccent(e.target.value)} className="h-10 w-full rounded-xl border bg-background px-3 text-sm">{ACCENTS.map((accent) => <option key={accent} value={accent}>{accent.split(" ")[0]}</option>)}</select></div>
            </div>
          </div>}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setModuleEdit(null)} className="rounded-xl">{t("common.cancel")}</Button><Button onClick={saveModule} disabled={!moduleName.trim()} className="rounded-xl">{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-user data dialog */}
      <Dialog open={!!dataFor} onOpenChange={(v) => !v && setDataFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              {t("sa.viewData")}
            </DialogTitle>
          </DialogHeader>
          {dataFor && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{dataFor.email}</p>
              {dataBusy ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("sa.loading")}
                </div>
              ) : dataSummary ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {(
                      [
                        ["system.life.name", dataSummary.life],
                        ["system.expense.name", dataSummary.expense],
                        ["system.business.name", dataSummary.business],
                        ["system.salon.name", dataSummary.salon],
                      ] as const
                    ).map(([k, n]) => (
                      <div key={k} className="rounded-2xl bg-muted/60 p-3">
                        <p className="text-[10px] text-muted-foreground">{t(k)}</p>
                        <p className="text-lg font-bold tabular-nums">{n}</p>
                        <p className="text-[9px] text-muted-foreground">{t("sa.records")}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="font-medium">
                      {t("sa.moduleViews")}:{" "}
                      <span className="tabular-nums text-foreground">{dataSummary.views}</span>
                    </span>
                    <span>
                      {t("sa.lastLogin")}:{" "}
                      <span className="text-foreground">{dataSummary.lastLogin ? formatStamp(dataSummary.lastLogin) : "—"}</span>
                    </span>
                    <span>
                      {t("sa.lastSeen")}:{" "}
                      <span className="text-foreground">{dataSummary.lastSeen ? formatStamp(dataSummary.lastSeen) : "—"}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-muted/60 px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("sa.noData")}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">{t("sa.isolationNote")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
