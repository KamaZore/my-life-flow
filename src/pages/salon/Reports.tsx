import { StatCard } from "@/components/systems/Shared";
import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateFilterBar } from "@/components/systems/DateFilterBar";
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useSalon, type DateFilter } from "@/lib/store";
import { resolveDateRange } from "@/lib/store";
import { CalendarCheck, CheckCircle2, Scissors, Users, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SalonReports() {
  const { t } = useI18n();
  const salon = useSalon();
  const [filter, setFilter] = useState<DateFilter>({ kind: "month" });
  const range = resolveDateRange(filter);

  const done = useMemo(
    () =>
      salon.appointments.filter(
        (a) => a.status === "done" && a.date >= range.from && a.date <= range.to,
      ),
    [salon.appointments, range],
  );
  const cancelled = useMemo(
    () =>
      salon.appointments.filter(
        (a) => a.status === "cancelled" && a.date >= range.from && a.date <= range.to,
      ),
    [salon.appointments, range],
  );

  const revenue = done.reduce((s, a) => s + a.price, 0);
  const commission = done.reduce((s, a) => {
    const m = salon.staff.find((x) => x.id === a.staffId);
    return s + (m ? (a.price * m.commission) / 100 : 0);
  }, 0);

  const svcStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const a of done) {
      const cur = map.get(a.serviceId) ?? { count: 0, total: 0 };
      map.set(a.serviceId, { count: cur.count + 1, total: cur.total + a.price });
    }
    return [...map.entries()]
      .map(([id, v]) => ({ name: salon.services.find((s) => s.id === id)?.name ?? "—", ...v }))
      .sort((a, b) => b.total - a.total);
  }, [done, salon.services]);

  const staffStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const a of done) {
      if (!a.staffId) continue;
      const cur = map.get(a.staffId) ?? { count: 0, total: 0 };
      map.set(a.staffId, { count: cur.count + 1, total: cur.total + a.price });
    }
    return [...map.entries()]
      .map(([id, v]) => {
        const m = salon.staff.find((x) => x.id === id);
        return {
          name: m?.name ?? "—",
          ...v,
          commission: Math.round((v.total * (m?.commission ?? 0)) / 100),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [done, salon.staff]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const a of done) byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.price);
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [done]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.reports")}</h1>
        <p className="text-sm text-muted-foreground">{t("salon.reportsSub")}</p>
      </div>

      <DateFilterBar value={filter} onChange={setFilter} />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label={t("salon.revenue")} value={moneyShort(revenue)} icon={Scissors} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.doneCount")} value={String(done.length)} icon={CheckCircle2} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard label={t("salon.cancelled")} value={String(cancelled.length)} icon={XCircle} tone="text-amber-600 dark:text-amber-400" tint="bg-amber-500/12" />
        <StatCard label={t("salon.commissionDue")} value={moneyShort(commission)} icon={Users} tone="text-violet-600 dark:text-violet-400" tint="bg-violet-500/12" className="col-span-2 lg:col-span-1" />
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t("salon.revenueByDay")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-56">
            {chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("exp.empty")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => moneyShort(v)} width={52} />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="total" fill="#ec4899" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salon.byService")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {svcStats.length === 0 && <p className="text-sm text-muted-foreground">{t("exp.empty")}</p>}
            {svcStats.map((s) => {
              const pct = Math.round((s.total / Math.max(1, revenue)) * 100);
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{s.name} · ×{s.count}</span>
                    <span className="text-muted-foreground">
                      {money(s.total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salon.byStaff")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {staffStats.length === 0 && <p className="text-sm text-muted-foreground">{t("exp.empty")}</p>}
            {staffStats.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">×{s.count} · {money(s.total)}</p>
                </div>
                <span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                  {t("salon.commission")} {money(s.commission)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarCheck className="size-3.5" />
        {t("salon.reportsNote")}
      </p>
    </div>
  );
}
