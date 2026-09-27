import { EmptyState, FadeIn, StatCard } from "@/components/systems/Shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, moneyShort } from "@/lib/format";
import { todayKey } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n";
import { useSalon } from "@/lib/store";
import { Package, Plus, Receipt, Scissors, Sparkles, TriangleAlert, TrendingUp, Users, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

export default function SalonDashboard() {
  const { t } = useI18n();
  const salon = useSalon();
  const navigate = useNavigate();
  const today = todayKey();
  const month = today.slice(0, 7);

  const todaySales = useMemo(() => salon.sales.filter((s) => s.date === today), [salon.sales, today]);
  const monthSales = useMemo(() => salon.sales.filter((s) => s.date.startsWith(month)), [salon.sales, month]);

  const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
  const monthRevenue = monthSales.reduce((s, x) => s + x.total, 0);
  const monthServiceRevenue = monthSales.reduce(
    (s, x) => s + x.lines.filter((l) => l.kind === "service").reduce((a, l) => a + l.price * l.qty, 0),
    0,
  );
  const monthProductRevenue = monthRevenue - monthServiceRevenue;
  const lowStock = salon.products.filter((p) => p.stock <= p.lowStockThreshold);

  const topServices = useMemo(() => {
    const counts = new Map<string, { name: string; color?: string; n: number; total: number }>();
    for (const sale of monthSales) {
      for (const l of sale.lines) {
        if (l.kind !== "service") continue;
        const cur = counts.get(l.itemId) ?? {
          name: l.name,
          color: salon.services.find((s) => s.id === l.itemId)?.color,
          n: 0,
          total: 0,
        };
        cur.n += l.qty;
        cur.total += l.price * l.qty;
        counts.set(l.itemId, cur);
      }
    }
    return [...counts.values()].sort((a, b) => b.total - a.total).slice(0, 3);
  }, [monthSales, salon.services]);

  const recentSales = salon.sales.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("system.salon.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("system.salon.desc")}</p>
        </div>
        <Button onClick={() => navigate("/salon/pos")} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.newSale")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label={t("salon.todayRevenue")}
          value={moneyShort(todayRevenue)}
          icon={Scissors}
          tone="text-rose-600 dark:text-rose-400"
          tint="bg-rose-500/12"
        />
        <StatCard
          label={t("salon.todayCount")}
          value={String(todaySales.length)}
          icon={Receipt}
          tone="text-sky-600 dark:text-sky-400"
          tint="bg-sky-500/12"
        />
        <StatCard
          label={t("salon.monthRevenue")}
          value={moneyShort(monthRevenue)}
          icon={TrendingUp}
          tone="text-emerald-600 dark:text-emerald-400"
          tint="bg-emerald-500/12"
        />
        <StatCard
          label={t("salon.customers")}
          value={String(salon.customers.length)}
          icon={Users}
          tone="text-violet-600 dark:text-violet-400"
          tint="bg-violet-500/12"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Service vs product split */}
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salon.monthSplit")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthRevenue === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("salon.noSales")}</p>
            ) : (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="size-3.5 text-rose-500" />
                      {t("nav.salon.services")}
                    </span>
                    <span className="text-muted-foreground">
                      {money(monthServiceRevenue)} · {Math.round((monthServiceRevenue / monthRevenue) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${(monthServiceRevenue / monthRevenue) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Package className="size-3.5 text-sky-500" />
                      {t("nav.salon.products")}
                    </span>
                    <span className="text-muted-foreground">
                      {money(monthProductRevenue)} · {Math.round((monthProductRevenue / monthRevenue) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${(monthProductRevenue / monthRevenue) * 100}%` }} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-amber-500" />
              {t("salon.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("salon.stockOk")}</p>
            )}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2 text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {t("salon.stock")}: {p.stock}
                </span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => navigate("/salon/products")}>
              {t("nav.salon.products")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Top services */}
      {topServices.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salon.topServices")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topServices.map((s) => {
              const pct = Math.round((s.total / Math.max(1, topServices[0].total)) * 100);
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{s.name} · ×{s.n}</span>
                    <span className="text-muted-foreground">{money(s.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color ?? "#ec4899" }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent walk-in sales */}
      <Card className="rounded-3xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-muted-foreground" />
            {t("salon.recentSales")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {recentSales.length === 0 && (
            <EmptyState
              icon={Scissors}
              title={t("salon.noSales")}
              hint={t("salon.posHint")}
              action={
                <Button onClick={() => navigate("/salon/pos")} className="rounded-xl">
                  {t("salon.newSale")}
                </Button>
              }
            />
          )}
          {recentSales.map((s, i) => (
            <FadeIn key={s.id} delay={i * 0.04}>
              <div className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Receipt className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    #{s.number} · {s.lines.map((l) => l.name).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.date}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{money(s.total)}</span>
              </div>
            </FadeIn>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
