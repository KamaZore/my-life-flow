import { DateFilterBar } from "@/components/systems/DateFilterBar";
import { StatCard } from "@/components/systems/Shared";
import { TransactionDialog } from "@/components/systems/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { money, moneyShort } from "@/lib/format";
import {
  byCategory,
  dailyTotals,
  filterTransactions,
  sumTransactions,
  useTransactions,
  type DateFilter,
} from "@/lib/store";
import { resolveDateRange } from "@/lib/store";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Plus,
  Wallet,
} from "lucide-react";
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

export default function ExpenseDashboard() {
  const { t } = useI18n();
  const transactions = useTransactions();
  const [filter, setFilter] = useState<DateFilter>({ kind: "month" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");

  const filtered = useMemo(
    () => filterTransactions(transactions, filter),
    [transactions, filter],
  );
  const totals = sumTransactions(filtered);
  const range = resolveDateRange(filter);

  const chartData = useMemo(
    () =>
      dailyTotals(transactions, range.from, range.to).map((d) => ({
        date: d.date.slice(5),
        income: d.income,
        expense: d.expense,
      })),
    [transactions, range],
  );

  const today = filterTransactions(transactions, { kind: "today" });
  const todayTotals = sumTransactions(today);

  const topExpenseCats = byCategory(filtered, "expense").slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("system.expense.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("select.subtitle")}</p>
        </div>
        <Button
          onClick={() => {
            setDefaultType("expense");
            setDialogOpen(true);
          }}
          className="gap-2 rounded-xl"
        >
          <Plus className="size-4" />
          {t("exp.addTx")}
        </Button>
      </div>

      <DateFilterBar value={filter} onChange={setFilter} />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("exp.totalIncome")}
          value={money(totals.income)}
          icon={ArrowDownLeft}
          tone="text-emerald-600 dark:text-emerald-400"
          delay={0}
        />
        <StatCard
          label={t("exp.totalExpense")}
          value={money(totals.expense)}
          icon={ArrowUpRight}
          tone="text-rose-600 dark:text-rose-400"
          delay={0.05}
        />
        <StatCard
          label={t("exp.balance")}
          value={money(totals.balance)}
          icon={Wallet}
          tone={totals.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
          delay={0.1}
        />
        <StatCard
          label={t("exp.todayExpense")}
          value={money(todayTotals.expense)}
          icon={Coins}
          tone="text-amber-600 dark:text-amber-400"
          delay={0.15}
        />
      </div>

      {/* Daily chart */}
      <Card className="rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t("exp.chart.daily")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => moneyShort(v)}
                  width={52}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top categories + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("exp.chart.categories")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topExpenseCats.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("exp.empty")}</p>
            )}
            {topExpenseCats.map((c) => {
              const pct = totals.expense ? Math.round((c.total / totals.expense) * 100) : 0;
              return (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{t(`exp.cat.${c.category}`)}</span>
                    <span className="text-muted-foreground">
                      {money(c.total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("exp.history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {filtered.slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <span
                  className={
                    "flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted " +
                    (tx.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400")
                  }
                >
                  {tx.type === "income" ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t(`exp.cat.${tx.category}`)}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
                <span
                  className={
                    "text-sm font-semibold " +
                    (tx.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400")
                  }
                >
                  {tx.type === "income" ? "+" : "−"}
                  {money(tx.amount)}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("exp.empty")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={defaultType}
      />
    </div>
  );
}

