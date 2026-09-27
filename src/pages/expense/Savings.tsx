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
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  addSavingGoal,
  contributeSaving,
  deleteSavingGoal,
  updateSavingGoal,
  useSavings,
} from "@/lib/store";
import type { SavingGoal } from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  History,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const GOAL_COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6"];

const emptyForm = {
  name: "",
  target: "",
  saved: "",
  targetDate: "",
  note: "",
  color: GOAL_COLORS[0],
};

export default function ExpenseSavings() {
  const { t } = useI18n();
  const goals = useSavings();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingGoal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [moveFor, setMoveFor] = useState<SavingGoal | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveDir, setMoveDir] = useState<"in" | "out">("in");
  const [historyFor, setHistoryFor] = useState<SavingGoal | null>(null);

  const totals = useMemo(() => {
    let saved = 0;
    let target = 0;
    let reached = 0;
    for (const g of goals) {
      saved += g.saved;
      target += g.target;
      if (g.saved >= g.target && g.target > 0) reached++;
    }
    return { saved, target, reached };
  }, [goals]);

  const monthlyIn = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    let sum = 0;
    for (const g of goals) {
      for (const c of g.contributions) {
        if (c.amount > 0 && c.date.startsWith(month)) sum += c.amount;
      }
    }
    return sum;
  }, [goals]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(g: SavingGoal) {
    setEditing(g);
    setForm({
      name: g.name,
      target: String(g.target),
      saved: String(g.saved),
      targetDate: g.targetDate ?? "",
      note: g.note ?? "",
      color: g.color ?? GOAL_COLORS[0],
    });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    const target = Number(form.target);
    if (!name || !target || target <= 0) return;
    const payload = {
      name,
      target,
      targetDate: form.targetDate || undefined,
      note: form.note.trim() || undefined,
      color: form.color,
    };
    if (editing) {
      updateSavingGoal(editing.id, {
        ...payload,
        saved: Math.max(0, Number(form.saved) || 0),
      });
      toast.success(t("sav.saved"));
    } else {
      addSavingGoal({ ...payload, saved: Math.max(0, Number(form.saved) || 0) });
      toast.success(t("sav.saved"));
    }
    setOpen(false);
  }

  function applyMove() {
    if (!moveFor) return;
    const amount = Number(moveAmount);
    if (!amount || amount <= 0) return;
    const delta = moveDir === "in" ? amount : -amount;
    const applied = contributeSaving(moveFor.id, delta);
    if (applied === 0) {
      toast.error(t("sav.errAmount"));
      return;
    }
    const crossed = moveDir === "in" && moveFor.saved < moveFor.target && moveFor.saved + applied >= moveFor.target && moveFor.target > 0;
    if (applied < 0) {
      toast.success(`${t("sav.withdrew")} ${money(-applied)} · ${moveFor.name}`);
    } else if (crossed) {
      toast.success(`${t("sav.reachedToast")} · ${moveFor.name} 🎉`);
    } else {
      toast.success(`${t("sav.added")} ${money(applied)} · ${moveFor.name}`);
    }
    setMoveFor(null);
    setMoveAmount("");
  }

  const removeGoal = (g: SavingGoal) => {
    deleteSavingGoal(g.id);
    toast.success(t("sav.deleted"));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("sav.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("sav.sub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("sav.add")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard
          label={t("sav.totalSaved")}
          value={moneyShort(totals.saved)}
          icon={PiggyBank}
          tone="text-emerald-600 dark:text-emerald-400"
          tint="bg-emerald-500/12"
        />
        <StatCard
          label={t("sav.thisMonth")}
          value={moneyShort(monthlyIn)}
          icon={TrendingUp}
          tone="text-sky-600 dark:text-sky-400"
          tint="bg-sky-500/12"
        />
        <StatCard
          label={t("sav.goalsReached")}
          value={`${totals.reached}/${goals.length}`}
          icon={CheckCircle2}
          tone="text-violet-600 dark:text-violet-400"
          tint="bg-violet-500/12"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map((g, i) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
          const reached = g.target > 0 && g.saved >= g.target;
          const remaining = Math.max(0, g.target - g.saved);
          return (
            <FadeIn key={g.id} delay={i * 0.04}>
              <div className="card-soft flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                    style={{ backgroundColor: `${g.color ?? "#10b981"}1f`, color: g.color ?? "#10b981" }}
                  >
                    {g.emoji ?? <PiggyBank className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      {reached && (
                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {t("sav.reached")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {g.targetDate ? `${t("exp.dueDate")}: ${g.targetDate}` : ""}
                      {g.note ? `${g.targetDate ? " · " : ""}${g.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(g)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-destructive"
                      onClick={() => removeGoal(g)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-lg font-bold tabular-nums leading-none">
                    {money(g.saved)}
                    <span className="text-xs font-medium text-muted-foreground"> / {money(g.target)}</span>
                  </p>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      reached ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: g.color ?? "#10b981" }}
                  />
                </div>
                {!reached && remaining > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {t("sav.remaining")}: {money(remaining)}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3">
                  <Button
                    size="sm"
                    className="h-8 flex-1 gap-1.5 rounded-lg text-xs"
                    onClick={() => {
                      setMoveFor(g);
                      setMoveDir("in");
                      setMoveAmount(String(Math.max(0, g.target - g.saved) || ""));
                    }}
                  >
                    <ArrowUp className="size-3.5" />
                    {t("sav.contribute")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 gap-1.5 rounded-lg text-xs"
                    disabled={g.saved <= 0}
                    onClick={() => {
                      setMoveFor(g);
                      setMoveDir("out");
                      setMoveAmount("");
                    }}
                  >
                    <ArrowDown className="size-3.5" />
                    {t("sav.withdraw")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => setHistoryFor(g)}
                    title={t("sav.history")}
                  >
                    <History className="size-4" />
                  </Button>
                </div>
              </div>
            </FadeIn>
          );
        })}
        {goals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2">
            <PiggyBank className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("sav.add")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("sav.sub")}</p>
          </div>
        )}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("sav.edit") : t("sav.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sav-name">{t("sav.goalName")}</Label>
              <Input
                id="sav-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl"
                autoFocus
              />
            </div>
            <MoneyInput
              label={t("sav.target")}
              valueUsd={form.target === "" ? null : Number(form.target)}
              onChangeUsd={(v) => setForm({ ...form, target: v === null ? "" : String(v) })}
            />
            <MoneyInput
              label={t("sav.alreadySaved")}
              valueUsd={form.saved === "" ? null : Number(form.saved)}
              onChangeUsd={(v) => setForm({ ...form, saved: v === null ? "" : String(v) })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="sav-date">{t("sav.targetDate")}</Label>
              <Input
                id="sav-date"
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sav.color")}</Label>
              <div className="flex gap-2">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`size-7 rounded-full border-2 transition-transform ${
                      form.color === c ? "scale-110 border-foreground/60" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sav-note">{t("exp.note")}</Label>
              <Input
                id="sav-note"
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
            <Button onClick={save} disabled={!(form.name.trim() && Number(form.target) > 0)} className="rounded-xl">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribute / withdraw dialog */}
      <Dialog open={!!moveFor} onOpenChange={(v) => !v && setMoveFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{moveDir === "in" ? t("sav.contribute") : t("sav.withdraw")}</DialogTitle>
          </DialogHeader>
          {moveFor && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["in", "out"] as const).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setMoveDir(dir)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      moveDir === dir
                        ? dir === "in"
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {dir === "in" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                    {dir === "in" ? t("sav.contribute") : t("sav.withdraw")}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{moveFor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("sav.totalSaved")}: {money(moveFor.saved)}
                  {moveFor.target > 0 ? ` · ${t("sav.remaining")}: ${money(Math.max(0, moveFor.target - moveFor.saved))}` : ""}
                </p>
              </div>
              <MoneyInput
                label={t("sav.amount")}
                valueUsd={moveAmount === "" ? null : Number(moveAmount)}
                onChangeUsd={(v) => setMoveAmount(v === null ? "" : String(v))}
                autoFocus
              />
              <Button onClick={applyMove} disabled={!(Number(moveAmount) > 0)} className="w-full rounded-xl">
                {t("common.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sav.history")}</DialogTitle>
          </DialogHeader>
          {historyFor && (
            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {historyFor.contributions.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("sav.noHistory")}</p>
              )}
              {historyFor.contributions.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      c.amount > 0
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {c.amount > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  </span>
                  <p className="flex-1 text-xs text-muted-foreground">
                    {c.date}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      c.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {c.amount > 0 ? "+" : ""}
                    {money(c.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
