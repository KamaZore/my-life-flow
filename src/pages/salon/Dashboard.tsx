import { FadeIn, StatCard, EmptyState } from "@/components/systems/Shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, moneyShort } from "@/lib/format";
import { todayKey } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n";
import { saveSalonAppointment, useSalon } from "@/lib/store";
import { CalendarDays, Check, Clock, Plus, Scissors, TrendingUp, Users, X } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function SalonDashboard() {
  const { t } = useI18n();
  const salon = useSalon();
  const navigate = useNavigate();
  const today = todayKey();

  const custName = (id: string) => salon.customers.find((c) => c.id === id)?.name ?? "—";
  const svcName = (id: string) => salon.services.find((s) => s.id === id)?.name ?? "—";
  const staffName = (id?: string) => salon.staff.find((s) => s.id === id)?.name ?? "—";

  const todays = useMemo(
    () =>
      salon.appointments
        .filter((a) => a.date === today)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [salon.appointments, today],
  );

  const monthRevenue = useMemo(() => {
    const month = today.slice(0, 7);
    return salon.appointments
      .filter((a) => a.status === "done" && a.date.startsWith(month))
      .reduce((sum, a) => sum + a.price, 0);
  }, [salon.appointments, today]);

  const topServices = useMemo(() => {
    const month = today.slice(0, 7);
    const counts = new Map<string, number>();
    for (const a of salon.appointments) {
      if (a.status !== "done" || !a.date.startsWith(month)) continue;
      counts.set(a.serviceId, (counts.get(a.serviceId) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [salon.appointments, today]);

  function setStatus(id: string, status: "done" | "cancelled" | "booked") {
    const appt = salon.appointments.find((a) => a.id === id);
    if (!appt) return;
    saveSalonAppointment({ ...appt, status });
    if (status === "done") toast.success(`${t("salon.done")} · ${custName(appt.customerId)}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("system.salon.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("system.salon.desc")}</p>
        </div>
        <Button onClick={() => navigate("/salon/appointments?add=1")} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.newAppointment")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label={t("salon.todayAppointments")}
          value={String(todays.length)}
          icon={CalendarDays}
          tone="text-rose-600 dark:text-rose-400"
          tint="bg-rose-500/12"
        />
        <StatCard
          label={t("salon.todayRevenue")}
          value={moneyShort(todays.filter((a) => a.status === "done").reduce((s, a) => s + a.price, 0))}
          icon={Scissors}
          tone="text-emerald-600 dark:text-emerald-400"
          tint="bg-emerald-500/12"
        />
        <StatCard
          label={t("salon.monthRevenue")}
          value={moneyShort(monthRevenue)}
          icon={TrendingUp}
          tone="text-violet-600 dark:text-violet-400"
          tint="bg-violet-500/12"
        />
        <StatCard
          label={t("salon.customers")}
          value={String(salon.customers.length)}
          icon={Users}
          tone="text-sky-600 dark:text-sky-400"
          tint="bg-sky-500/12"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("salon.todaySchedule")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todays.length === 0 && (
            <EmptyState icon={CalendarDays} title={t("salon.noToday")} hint={t("salon.newAppointment")} />
          )}
          {todays.map((a, i) => (
            <FadeIn key={a.id} delay={i * 0.04}>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-background/60 p-3">
                <span className="flex w-14 shrink-0 items-center justify-center gap-1 rounded-xl bg-muted py-1.5 text-xs font-bold tabular-nums">
                  <Clock className="size-3 text-muted-foreground" />
                  {a.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{custName(a.customerId)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {svcName(a.serviceId)} · {staffName(a.staffId)} · {money(a.price)}
                  </p>
                </div>
                {a.status === "booked" && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" className="h-8 gap-1 rounded-lg text-xs" onClick={() => setStatus(a.id, "done")}>
                      <Check className="size-3.5" />
                      {t("salon.done")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 rounded-lg text-xs text-destructive hover:text-destructive"
                      onClick={() => setStatus(a.id, "cancelled")}
                    >
                      <X className="size-3.5" />
                      {t("salon.cancelled")}
                    </Button>
                  </div>
                )}
                {a.status === "done" && (
                  <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("salon.done")}
                  </span>
                )}
                {a.status === "cancelled" && (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                    {t("salon.cancelled")}
                  </span>
                )}
              </div>
            </FadeIn>
          ))}
        </CardContent>
      </Card>

      {topServices.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salon.topServices")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topServices.map(([id, n]) => {
              const svc = salon.services.find((s) => s.id === id);
              const pct = Math.round((n / Math.max(1, topServices[0][1])) * 100);
              return (
                <div key={id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{svc?.name ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {n} × {t("salon.doneShort")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: svc?.color ?? "#ec4899" }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
