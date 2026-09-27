import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { collectNotifications } from "@/lib/notifications";
import { useAppData } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Bell, CalendarDays, CircleAlert, Package, PiggyBank, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

const SYSTEM_DOT: Record<string, string> = {
  salon: "text-rose-600 dark:text-rose-400",
  business: "text-violet-600 dark:text-violet-400",
  expense: "text-sky-600 dark:text-sky-400",
  life: "text-emerald-600 dark:text-emerald-400",
  admin: "text-amber-600 dark:text-amber-400",
};

function NotifIcon({ titleKey }: { titleKey: string }) {
  if (titleKey.includes("lowStock")) return <Package className="size-4" />;
  if (titleKey.includes("booking")) return <CalendarDays className="size-4" />;
  if (titleKey.includes("Debt") || titleKey.includes("budget")) return <TriangleAlert className="size-4" />;
  return <PiggyBank className="size-4" />;
}

/** Header bell with a live count of actionable alerts across systems. */
export function NotificationBell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const data = useAppData();
  const [open, setOpen] = useState(false);

  // Re-collect whenever any data changes.
  const notifications = useMemo(() => collectNotifications(), [data]);
  const count = notifications.length;
  const dangers = notifications.filter((n) => n.severity === "danger").length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9 rounded-xl" aria-label={t("notif.title")}>
          <Bell className="size-4.5" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white",
                dangers > 0 ? "bg-rose-500" : "bg-amber-500",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2">
        <p className="px-2 pb-2 pt-1 text-xs font-bold text-muted-foreground">
          {t("notif.title")} · {count}
        </p>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <CircleAlert className="size-4" />
              {t("notif.empty")}
            </p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setOpen(false);
                navigate(n.to);
              }}
              className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                  n.severity === "danger"
                    ? "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                    : n.severity === "warning"
                      ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                      : "bg-sky-500/12 text-sky-600 dark:text-sky-400",
                )}
              >
                <NotifIcon titleKey={n.titleKey} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {t(n.titleKey)} · {n.titleText}
                </span>
                <span className={cn("block truncate text-[11px] text-muted-foreground", SYSTEM_DOT[n.system])}>
                  {n.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
