import { DateFilterBar } from "@/components/systems/DateFilterBar";
import { FadeIn } from "@/components/systems/Shared";
import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
import {
  byCategory,
  filterTransactions,
  setBudget,
  sumTransactions,
  useAppData,
  useTransactions,
  type DateFilter,
} from "@/lib/store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/types";
import { PiggyBank, Pencil, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

const EXP_COLORS = [
  "#f43f5e", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#64748b", "#84cc16", "#94a3b8",
];
const INC_COLORS = ["#10b981", "#22d3ee", "#a3e635", "#facc15", "#94a3b8"];

/** All categories present in the doc, even custom ones. */
function categoriesOf(
  txs: { category: string; type: "income" | "expense" }[],
  type: "income" | "expense",
): string[] {
  const set = new Set(txs.filter((t) => t.type === type).map((t) => t.category));
  const defaults = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return [...new Set([...defaults, ...set])];
}

export default function ExpenseCategories() {
  const { t, lang } = useI18n();
  const transactions = useTransactions();
  const appData = useAppData();
  const budgets = appData.budgets;
  const [filter, setFilter] = useState<DateFilter>({ kind: "month" });
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [budgetFor, setBudgetFor] = useState<string | null>(null);
  const [budgetVal, setBudgetVal] = useState("");

  const filtered = useMemo(
    () => filterTransactions(transactions, filter, { type: tab }),
    [transactions, filter, tab],
  );
  const totals = sumTransactions(filtered);
  const cats = byCategory(filtered, tab);
  const allCats = categoriesOf(transactions, tab);

  const chartData = cats.map((c, i) => ({
    name: t(`exp.cat.${c.category}`),
    value: c.total,
    color: (tab === "expense" ? EXP_COLORS : INC_COLORS)[i % 8] ?? "#94a3b8",
  }));

  /** Monthly budget progress for the active tab (only categories with a budget). */
  const budgetRows = useMemo(() => {
    if (tab !== "expense") return [];
    const monthFilter = filter.kind === "month" || filter.kind === "custom" ? filter : ({ kind: "month" } as DateFilter);
    const spentMap = new Map(
      byCategory(filterTransactions(transactions, monthFilter, { type: "expense" }), "expense").map(
        (c) => [c.category, c.total],
      ),
    );
    return Object.entries(budgets)
      .filter(([, limit]) => limit > 0)
      .map(([category, limit]) => ({
        category,
        limit,
        spent: spentMap.get(category) ?? 0,
      }))
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  }, [tab, budgets, transactions, filter]);

  const totalBudget = budgetRows.reduce((s, r) => s + r.limit, 0);
  const totalSpentOnBudgets = budgetRows.reduce((s, r) => s + r.spent, 0);

  function openBudget(category: string) {
    setBudgetFor(category);
    setBudgetVal(budgets[category] ? String(budgets[category]) : "");
  }

  function saveBudget() {
    if (!budgetFor) return;
    setBudget(budgetFor, Number(budgetVal) || 0);
    setBudgetFor(null);
    toast.success(t("biz.budgetSaved"));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.exp.categories")}</h1>
        <p className="text-sm text-muted-foreground">{t("exp.chart.categories")}</p>
      </div>

      <DateFilterBar value={filter} onChange={setFilter} />

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1 sm:max-w-xs">
        {(["expense", "income"] as const).map((tx) => (
          <button
            key={tx}
            onClick={() => setTab(tx)}
            className={
              "rounded-xl py-2 text-sm font-semibold transition-colors " +
              (tab === tx ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            {tx === "expense" ? t("exp.type.expense") : lang === "km" ? "ចំណូលរកបាន" : t("exp.type.income")}
          </button>
        ))}
      </div>

      {/* Monthly budgets */}
      {tab === "expense" && (
        <FadeIn>
          <Card className="card-soft rounded-3xl border-border/60">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PiggyBank className="size-4.5 text-primary" />
                {t("biz.budgets")}
              </CardTitle>
              {budgetRows.length > 0 && (
                <div className="text-right text-xs text-muted-foreground">
                  {money(totalSpentOnBudgets)} / {money(totalBudget)}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {budgetRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 py-8 text-center">
                  <Target className="size-7 text-muted-foreground/50" />
                  <p className="max-w-xs text-xs text-muted-foreground">{t("biz.budgetHint")}</p>
                </div>
              ) : (
                budgetRows.map((r) => {
                  const pct = Math.min(100, Math.round((r.spent / r.limit) * 100));
                  const over = r.spent > r.limit;
                  return (
                    <div key={r.category} className="group">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">{t(`exp.cat.${r.category}`)}</span>
                        <span className="flex items-center gap-1.5">
                          <span className={over ? "font-semibold text-destructive" : "text-muted-foreground"}>
                            {money(r.spent)} / {money(r.limit)}
                          </span>
                          <button
                            onClick={() => openBudget(r.category)}
                            className="rounded-lg p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            aria-label={t("biz.editBudget")}
                          >
                            <Pencil className="size-3" />
                          </button>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            "h-full rounded-full transition-all " +
                            (over
                              ? "bg-destructive"
                              : pct > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500")
                          }
                          style={{ width: `${Math.max(pct, r.spent > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allCats
                  .filter((c) => !budgets[c])
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() => openBudget(c)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <Plus className="size-3" />
                      {t(`exp.cat.${c}`)}
                    </button>
                  ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <FadeIn delay={0.05}>
          <Card className="card-soft rounded-3xl border-border/60">
            <CardContent className="pt-6">
              {chartData.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">{t("exp.empty")}</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="card-soft rounded-3xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("exp.report.period")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {cats.map((c) => {
                const pct = totals.expense + totals.income
                  ? Math.round((c.total / (tab === "expense" ? totals.expense : totals.income)) * 100)
                  : 0;
                const color = (tab === "expense" ? EXP_COLORS : INC_COLORS)[
                  cats.findIndex((x) => x.category === c.category) % 8
                ] ?? "#94a3b8";
                return (
                  <div key={c.category} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="flex-1 text-sm font-medium">{t(`exp.cat.${c.category}`)}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <span className="w-20 text-right text-sm font-semibold">{money(c.total)}</span>
                  </div>
                );
              })}
              {cats.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("exp.empty")}</p>
              )}
              {cats.length > 0 && (
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                  <span className="font-semibold">{tab === "expense" ? t("exp.type.expense") : lang === "km" ? "ចំណូលរកបាន" : t("exp.type.income")}</span>
                  <span className="font-bold">
                    {money(tab === "expense" ? totals.expense : totals.income)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <Dialog open={Boolean(budgetFor)} onOpenChange={(v) => !v && setBudgetFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("biz.editBudget")} — {budgetFor ? t(`exp.cat.${budgetFor}`) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <MoneyInput
              valueUsd={budgetVal === "" ? null : Number(budgetVal)}
              onChangeUsd={(v) => setBudgetVal(v === null ? "" : String(v))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t("biz.budgetZeroClears")}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBudgetFor(null)} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button onClick={saveBudget} className="rounded-xl">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
