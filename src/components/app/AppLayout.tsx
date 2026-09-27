import { QuickAddDialog } from "@/components/app/QuickAddDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { SYSTEMS, type SystemDef } from "@/systems";
import { useAuth } from "@/hooks/use-auth";
import {
  ICONS,
  loadModules,
  selectableModules,
  useModules,
} from "@/lib/modules";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Languages,
  LayoutGrid,
  Moon,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

export type QuickAddType =
  | "task"
  | "project"
  | "process"
  | "habit"
  | "goal"
  | "note";

function FlowdayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="currentColor" />
      <path
        d="M150 176 L236 256 L150 336"
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M250 176 L336 256 L250 336"
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M350 176 L436 256 L350 336"
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function SidebarNav({ system }: { system: SystemDef }) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1">
      {system.nav.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-primary/10 font-semibold text-primary",
            )
          }
        >
          <item.icon className="size-4" />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}

function SystemBadge({ system }: { system: SystemDef }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <system.icon className={cn("size-3", system.accent)} />
      {t(system.labelKey)}
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  const next = lang === "en" ? "km" : "en";
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold"
      onClick={() => setLang(next)}
      aria-label="Switch language / ប្ដូរភាសា"
    >
      <Languages className="size-4" />
      {next === "km" ? "ខ្មែរ" : "EN"}
    </Button>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { resolved, toggle } = useTheme();
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const modules = useModules();

  useEffect(() => {
    void loadModules();
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<QuickAddType>("task");
  const [bizMenuOpen, setBizMenuOpen] = useState(false);

  // The active system is derived from the URL: /life/*, /expense/*, /business/*
  const system =
    SYSTEMS.find(
      (s) => location.pathname === s.root || location.pathname.startsWith(s.root + "/"),
    ) ?? SYSTEMS[0];

  const openQuickAdd = (type: QuickAddType = "task") => {
    setQuickAddType(type);
    setQuickAddOpen(true);
  };

  /**
   * Per-system quick action: Life opens the capture dialog, Expense jumps to
   * a new transaction, Business opens an action menu (sale/product/customer).
   */
  const primaryAction = (() => {
    switch (system.id) {
      case "expense":
        return { kind: "navigate" as const, to: "/expense/transactions?add=1" };
      case "business":
        return { kind: "menu" as const };
      default:
        return { kind: "dialog" as const };
    }
  })();

  function handlePrimaryClick() {
    if (primaryAction.kind === "navigate") {
      navigate(primaryAction.to);
    } else if (primaryAction.kind === "dialog") {
      openQuickAdd("task");
    } else {
      setBizMenuOpen((v) => !v);
    }
  }

  // Support ?quickadd=task deep link (PWA shortcuts)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qa = params.get("quickadd");
    if (qa) {
      openQuickAdd(qa as QuickAddType);
      params.delete("quickadd");
      const qs = params.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, {
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop offline indicator (inside the fixed sidebar) */}
      <aside className="safe-x fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <div className="fixed left-60 right-0 top-0 hidden md:block">
          <OfflineBanner />
        </div>
        <button
          onClick={() => navigate(system.root)}
          className="mb-4 flex w-full items-center gap-2.5 px-2 text-left"
        >
          <FlowdayLogo className="size-9 rounded-xl text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">
              Flowday
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {t(system.labelKey)}
            </span>
          </span>
        </button>
        <button
          onClick={() => navigate("/select-system")}
          className={cn(
            "mb-5 flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <span className="flex items-center gap-2">
            <system.icon className={cn("size-4", system.accent)} />
            {t(system.labelKey)}
          </span>
          <LayoutGrid className="size-3.5" />
        </button>
        <SidebarNav system={system} />
        <div className="mt-auto flex items-center gap-2 px-2 pt-4">
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {resolved === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {resolved === "dark" ? t("theme.darkMode") : t("theme.lightMode")}
          </span>
          <LangToggle />
        </div>
      </aside>

      {/* Mobile header — safe-area aware */}
      <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur md:hidden">
        <OfflineBanner />
        <div className="flex h-14 items-center justify-between px-4">
          {/* Logo + system switcher (tap to jump to another system) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-accent"
                aria-label={t("select.choose")}
              >
                <FlowdayLogo className="size-7 shrink-0 rounded-lg text-primary" />
                <span className="min-w-0 truncate text-base font-bold">Flowday</span>
                <span className={cn("hidden min-[380px]:inline-block truncate text-xs font-semibold", system.accent)}>
                  · {t(system.labelKey)}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 rounded-2xl p-1.5">
              {selectableModules(modules)
                .filter((m) =>
                  m.custom ? true : can((m.permKey ?? m.id) as "life" | "expense" | "business" | "salon" | "admin"),
                )
                .map((m) => {
                  const Icon = ICONS[m.icon] ?? ICONS.sparkles;
                  const name = m.labelKey
                    ? t(m.labelKey)
                    : (lang === "km" && m.nameKm ? m.nameKm : m.name) ?? m.id;
                  const target = m.custom && m.path
                    ? (/^https?:/i.test(m.path) ? undefined : m.path)
                    : m.path ?? `/${m.id}`;
                  const external = m.custom && m.path && /^https?:/i.test(m.path);
                  return (
                    <DropdownMenuItem key={m.id} asChild>
                      <button
                        onClick={() => {
                          if (external) window.location.assign(m.path!);
                          else if (target) navigate(target);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5"
                      >
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted")}>
                          <Icon className={cn("size-4", m.accent)} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                        {!m.custom && m.builtin === system.id && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </button>
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1.5">
            <LangToggle />
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {resolved === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content — extra bottom padding clears the safe-area nav.
          No safe-x here: the body already pads by the safe-area inset, so
          adding it again doubled the side margins on notched phones. */}
      <main className="px-4 pb-safe pt-4 md:ml-60 md:px-8 md:pb-16 md:pt-8">
        <div className="relative min-h-[50vh]">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* Mobile bottom nav — grows with the home indicator inset */}
      <nav className="safe-nav safe-x fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border/60 bg-background/90 backdrop-blur md:hidden">
        {[0, 1, 2].map((idx) => {
          const item = system.nav[idx];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  // Container .safe-nav already covers the home-indicator inset;
                  // adding it here too double-counted it on notched phones.
                  "flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 text-[10px] font-medium text-muted-foreground transition-colors",
                  isActive && "text-primary",
                )
            }
            >
              <item.icon className="size-5" />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
        <MobileMoreMenu />
      </nav>

      {/* Center FAB (mobile) — per-system quick action: Life captures a task,
          Expense logs a transaction, Business opens the sale/add menu. */}
      <button
        onClick={handlePrimaryClick}
        className="card-soft fab-safe fixed left-1/2 z-40 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        aria-label={system.id === "expense" ? t("exp.addTx") : t("quick.title")}
      >
        <Plus
          className={cn(
            "size-6 transition-transform",
            primaryAction.kind === "menu" && bizMenuOpen && "rotate-45",
          )}
        />
      </button>

      {/* Business quick menu (mobile — anchored above the FAB) */}
      {system.id === "business" && bizMenuOpen && (
        <div
          className="fixed left-1/2 z-40 flex -translate-x-1/2 flex-col gap-1.5 rounded-2xl border border-border/60 bg-popover p-1.5 shadow-xl md:hidden"
          style={{ bottom: "calc(140px + env(safe-area-inset-bottom, 0px))" }}
        >
          <BizMenuItems onPick={() => setBizMenuOpen(false)} />
        </div>
      )}

      {/* Business quick menu (desktop — anchored above the button) */}
      {system.id === "business" && bizMenuOpen && (
        <div className="fixed bottom-20 right-6 z-40 hidden flex-col gap-1.5 rounded-2xl border border-border/60 bg-popover p-1.5 shadow-xl md:flex">
          <BizMenuItems onPick={() => setBizMenuOpen(false)} />
        </div>
      )}

      {/* Desktop quick add — label follows the active system */}
      <Button
        onClick={handlePrimaryClick}
        className="card-soft fixed bottom-6 right-6 z-40 hidden h-12 gap-2 rounded-full px-5 shadow-lg md:inline-flex"
      >
        <Plus
          className={cn(
            "size-5 transition-transform",
            primaryAction.kind === "menu" && bizMenuOpen && "rotate-45",
          )}
        />
        {system.id === "expense" ? t("exp.addTx") : t("quick.title")}
      </Button>

      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        defaultType={quickAddType}
      />
    </div>
  );
}

/** Quick actions inside the Business FAB menu. */
function BizMenuItems({ onPick }: { onPick: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const actions = [
    { label: t("biz.newSale"), icon: ShoppingCart, onClick: () => navigate("/business/pos") },
    { label: t("biz.addProduct"), icon: Package, onClick: () => navigate("/business/products?add=1") },
    { label: t("biz.addCustomer"), icon: Users, onClick: () => navigate("/business/customers?add=1") },
    { label: t("biz.addBizExpense"), icon: Receipt, onClick: () => navigate("/business/expenses?add=1") },
  ];
  return (
    <>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => {
            onPick();
            a.onClick();
          }}
          className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <a.icon className="size-4 text-primary" />
          {a.label}
        </button>
      ))}
    </>
  );
}

/** Mobile “More” menu covering the nav items that don't fit in the bottom bar. */
function MobileMoreMenu() {
  const { t } = useI18n();
  const location = useLocation();
  const system =
    SYSTEMS.find(
      (s) => location.pathname === s.root || location.pathname.startsWith(s.root + "/"),
    ) ?? SYSTEMS[0];
  const moreItems = system.nav.slice(3);
  // useLocation re-renders on every navigation, so the active state is never
  // stale (the old window.location.pathname read was — it didn't update).
  const moreActive = moreItems.some((i) => location.pathname === i.path);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 text-[10px] font-medium text-muted-foreground transition-colors data-[active=true]:text-primary"
          data-active={moreActive}
        >
          <LayoutGrid className={cn("size-5", moreActive && "text-primary")} />
          {t("nav.more")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        className="mb-2 grid w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-1 rounded-2xl p-2 sm:grid-cols-3"
      >
        {moreItems.map((item) => (
          <DropdownMenuItem key={item.path} asChild>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground",
                  isActive && "bg-primary/10 text-primary",
                )
              }
            >
              <item.icon className="size-5" />
              {t(item.labelKey)}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
