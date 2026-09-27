import { FadeIn, StatCard } from "@/components/systems/Shared";
import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { todayKey } from "@/lib/date-utils";
import {
  addRecurring,
  deleteRecurring,
  postDueRecurring,
  updateRecurring,
  useRecurring,
} from "@/lib/store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, type RecurringTx } from "@/lib/types";
import { CalendarClock, Coins, Pencil, Play, Plus, Repeat2, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** Occurrence of a rule in the current month, clamped to month end. */
function occurrenceThisMonth(rule: RecurringTx): string {
  const ym = todayKey().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, rule.dayOfMonth), lastDay);
  return `${ym}-${String(day).padStart(2, "0")}`;
}

const emptyForm = {
  type: "expense" as "income" | "expense",
  amount: "",
  category: "bills",
  method: "cash",
  dayOfMonth: "1",
  startDate: todayKey(),
  note: "",
};

export default function ExpenseRecurring() {
  const { t } = useI18n();
  const rules = useRecurring();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTx | null>(null);
  const [form, setForm] = useState(emptyForm);

  const today = todayKey();

  /** A rule is due when this month's occurrence is today/past and unposted. */
  const dueRules = useMemo(
    () =>
      rules.filter((r) => {
        if (!r.active) return false;
        const occ = occurrenceThisMonth(r);
        if (occ > today) return false;
        return !r.lastRun || r.lastRun < occ;
      }),
    [rules, today],
  );

  const monthlyExpense = rules
    .filter((r) => r.active && r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);
  const monthlyIncome = rules
    .filter((r) => r.active && r.type === "income")
    .reduce((s, r) => s + r.amount, 0);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(r: RecurringTx) {
    setEditing(r);
    setForm({
      type: r.type,
      amount: String(r.amount),
      category: r.category,
      method: r.method,
      dayOfMonth: String(r.dayOfMonth),
      startDate: r.startDate,
      note: r.note ?? "",
    });
    setOpen(true);
  }

  function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    const payload = {
      type: form.type,
      amount,
      category: form.category,
      method: form.method as RecurringTx["method"],
      startDate: form.startDate,
      dayOfMonth: Math.min(31, Math.max(1, Number(form.dayOfMonth) || 1)),
      note: form.note.trim() || undefined,
      active: editing?.active ?? true,
    };
    if (editing) {
      updateRecurring(editing.id, payload);
    } else {
      addRecurring(payload);
    }
    toast.success(t("exp.recurringSaved"));
    setOpen(false);
  }

  function postNow() {
    const n = postDueRecurring();
    toast.success(t("exp.posted", { n }));
  }

  const categories = form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("exp.recurring")}</h1>
          <p className="text-sm text-muted-foreground">{t("exp.recurringSub")}</p>
        </div>
        <div className="flex items-center gap-2">
          {dueRules.length > 0 && (
            <Button onClick={postNow} className="gap-2 rounded-xl">
              <Play className="size-4" />
              {t("exp.postNow")}
            </Button>
          )}
          <Button variant="outline" onClick={openAdd} className="gap-2 rounded-xl">
            <Plus className="size-4" />
            {t("exp.addRecurring")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("exp.totalExpense")} value={money(monthlyExpense)} icon={Wallet} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("exp.totalIncome")} value={money(monthlyIncome)} icon={TrendingUp} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("exp.recurring")} value={String(rules.length)} icon={Repeat2} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard
          label={dueRules.length > 0 ? t("exp.recurringDue", { n: dueRules.length }) : t("exp.recurringUpToDate")}
          value={dueRules.length > 0 ? money(dueRules.reduce((s, r) => s + r.amount, 0)) : "✓"}
          icon={CalendarClock}
          tone={dueRules.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
          tint={dueRules.length > 0 ? "bg-amber-500/12" : "bg-emerald-500/12"}
        />
      </div>

      <div className="space-y-2.5">
        {rules.map((r, i) => {
          const occ = occurrenceThisMonth(r);
          const isDue = r.active && occ <= today && (!r.lastRun || r.lastRun < occ);
          return (
            <FadeIn key={r.id} delay={i * 0.03}>
              <div className="card-soft flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${r.type === "income" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}>
                  <Coins className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{t(`exp.cat.${r.category}`)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.type === "income" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}>
                      {t(`exp.type.${r.type}`)}
                    </span>
                    {isDue && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        {t("exp.dueNow")}
                      </span>
                    )}
                    {!r.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t("exp.inactive")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("exp.dayOfMonth")} {r.dayOfMonth}
                    {" · "}
                    {t("exp.lastRun")}: {r.lastRun ?? t("exp.never")}
                    {r.note ? ` · ${r.note}` : ""}
                    {r.active && occ > today ? ` · ${t("exp.nextOccurrence", { date: occ })}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className={`text-sm font-bold tabular-nums ${r.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {r.type === "income" ? "+" : "−"}
                    {money(r.amount)}
                  </p>
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg text-destructive"
                    onClick={() => deleteRecurring(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </FadeIn>
          );
        })}
        {rules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
            <Repeat2 className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("exp.addRecurring")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("exp.editRecurring") : t("exp.addRecurring")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setForm({ ...form, type: tp, category: tp === "expense" ? "bills" : "salary" })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    form.type === tp
                      ? tp === "expense"
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t(`exp.type.${tp}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MoneyInput
                valueUsd={form.amount === "" ? null : Number(form.amount)}
                onChangeUsd={(v) => setForm({ ...form, amount: v === null ? "" : String(v) })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="rec-day">{t("exp.dayOfMonth")}</Label>
                <Input
                  id="rec-day"
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                  className="h-10 rounded-xl"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t("exp.category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{t(`exp.cat.${c}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("exp.method")}</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{t(`pay.${m}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-start">{t("exp.startDate")}</Label>
              <Input
                id="rec-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-note">{t("exp.note")}</Label>
              <Input
                id="rec-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!(Number(form.amount) > 0)} className="rounded-xl">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
