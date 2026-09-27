import { StatCard } from "@/components/systems/Shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateFilterBar } from "@/components/systems/DateFilterBar";
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useSalon, resolveDateRange, type DateFilter } from "@/lib/store";
import { Banknote, CreditCard, Landmark, Scissors, ShoppingBag, Users, Wallet, XCircle } from "lucide-react";
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

const METHOD_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  card: CreditCard,
  bank: Landmark,
  other: Wallet,
};

export default function SalonReports() {
  const { t } = useI18n();
  const salon = useSalon();
  const [filter, setFilter] = useState<DateFilter>({ kind: "month" });
  const range = resolveDateRange(filter);

  const sales = useMemo(
    () => salon.sales.filter((s) => s.date >= range.from && s.date <= range.to),
    [salon.sales, range],
  );
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const discountTotal = sales.reduce((s, x) => s + x.discountTotal, 0);
  const commission = sales.reduce(
    (s, x) =>
      s +
      x.lines.reduce((a, l) => {
        const m = salon.staff.find((y) => y.id === l.staffId);
        return a + (m ? ((l.price * l.qty) * m.commission) / 100 : 0);
      }, 0),
    0,
  );

  const serviceRevenue = sales.reduce(
    (s, x) => s + x.lines.filter((l) => l.kind === "service").reduce((a, l) => a + l.price * l.qty, 0),
    0,
  );
  const productRevenue = sales.reduce(
    (s, x) => s + x.lines.filter((l) => l.kind === "product").reduce((a, l) => a + l.price * l.qty, 0),
    0,
  );

  const chartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of sales) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.total);
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [sales]);

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) map.set(s.method, (map.get(s.method) ?? 0) + s.total);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);

  const staffStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const s of sales) {
      for (const l of s.lines) {
        if (l.kind !== "service" || !l.staffId) continue;
        const cur = map.get(l.staffId) ?? { count: 0, total: 0 };
        cur.count += l.qty;
        cur.total += l.price * l.qty;
        map.set(l.staffId, cur);
      }
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
  }, [sales, salon.staff]);

  const productStats = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      for (const l of s.lines) {
        if (l.kind !== "product") continue;
        const cur = map.get(l.itemId) ?? { name: l.name, qty: 0, total: 0 };
        cur.qty += l.qty;
        cur.total += l.price * l.qty;
        map.set(l.itemId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.reports")}</h1>
        <p className="text-sm text-muted-foreground">{t("salon.reportsSub")}</p>
      </div>

      <DateFilterBar value={filter} onChange={setFilter} />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label={t("salon.revenue")} value={moneyShort(revenue)} icon={Scissors} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.saleCount", { n: sales.length })} value={String(sales.length)} icon={ShoppingBag} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard label={t("salon.discount")} value={moneyShort(discountTotal)} icon={XCircle} tone="text-amber-600 dark:text-amber-400" tint="bg-amber-500/12" />
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
            <CardTitle className="text-base">{t("salon.monthSplit")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revenue === 0 && <p className="text-sm text-muted-foreground">{t("exp.empty")}</p>}
            {revenue > 0 && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Scissors className="size-3.5 text-rose-500" />
                      {t("nav.salon.services")}
                    </span>
                    <span className="text-muted-foreground">
                      {money(serviceRevenue)} · {Math.round((serviceRevenue / revenue) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${(serviceRevenue / revenue) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShoppingBag className="size-3.5 text-sky-500" />
                      {t("nav.salon.products")}
                    </span>
                    <span className="text-muted-foreground">
                      {money(productRevenue)} · {Math.round((productRevenue / revenue) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${(productRevenue / revenue) * 100}%` }} />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5 border-t border-border/50 pt-3">
              <p className="text-xs font-semibold text-muted-foreground">{t("exp.method")}</p>
              {byMethod.map(([m, total]) => {
                const Icon = METHOD_ICON[m] ?? Wallet;
                return (
                  <div key={m} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="size-3.5" />
                      {t(`pay.${m}`)}
                    </span>
                    <span className="font-bold tabular-nums">{money(total)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("salon.byStaff")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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

          {productStats.length > 0 && (
            <Card className="rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("salon.topProducts")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {productStats.map((p) => (
                  <div key={p.name} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate font-medium">{p.name} ×{p.qty}</span>
                    <span className="shrink-0 font-bold tabular-nums">{money(p.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
