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
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  addDebt,
  deleteDebt,
  payDebt,
  updateDebt,
  useDebts,
} from "@/lib/store";
import type { Debt } from "@/lib/types";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  direction: "payable" as Debt["direction"],
  total: "",
  dueDate: "",
  note: "",
};

export default function ExpenseDebts() {
  const { t } = useI18n();
  const debts = useDebts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [payFor, setPayFor] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const openDebts = useMemo(() => debts.filter((d) => d.paid < d.total), [debts]);

  const totals = useMemo(() => {
    let youOwe = 0;
    let owedToYou = 0;
    for (const d of openDebts) {
      const remaining = d.total - d.paid;
      if (d.direction === "payable") youOwe += remaining;
      else owedToYou += remaining;
    }
    return { youOwe, owedToYou };
  }, [openDebts]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Debt) {
    setEditing(d);
    setForm({
      name: d.name,
      direction: d.direction,
      total: String(d.total),
      dueDate: d.dueDate ?? "",
      note: d.note ?? "",
    });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    const total = Number(form.total);
    if (!name || !total || total <= 0) return;
    const payload = {
      name,
      direction: form.direction,
      total,
      dueDate: form.dueDate || undefined,
      note: form.note.trim() || undefined,
    };
    if (editing) {
      updateDebt(editing.id, payload);
    } else {
      addDebt(payload);
    }
    toast.success(t("exp.debtSaved"));
    setOpen(false);
  }

  function recordPayment() {
    if (!payFor) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    const applied = payDebt(payFor.id, amount);
    if (applied > 0) {
      const settled = payFor.paid + applied >= payFor.total;
      toast.success(
        settled
          ? `${t("exp.debtSettled")} · ${payFor.name}`
          : `${t("exp.paid")} ${money(applied)} · ${payFor.name}`,
      );
    }
    setPayFor(null);
    setPayAmount("");
  }

  const overdue = (d: Debt) =>
    d.paid < d.total && d.dueDate !== undefined && d.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("exp.debts")}</h1>
          <p className="text-sm text-muted-foreground">{t("exp.debtsSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("exp.addDebt")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label={t("exp.iOwe")} value={moneyShort(totals.youOwe)} icon={ArrowUpRight} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("exp.owedToMe")} value={moneyShort(totals.owedToYou)} icon={ArrowDownLeft} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("exp.debts")} value={String(openDebts.length)} icon={HandCoins} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
      </div>

      <div className="space-y-2.5">
        {debts.map((d, i) => {
          const remaining = d.total - d.paid;
          const settled = remaining <= 0;
          const pct = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
          return (
            <FadeIn key={d.id} delay={i * 0.03}>
              <div className="card-soft rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                      settled
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : d.direction === "payable"
                          ? "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                          : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {d.direction === "payable" ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{d.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          d.direction === "payable"
                            ? "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                            : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {t(d.direction === "payable" ? "exp.payable" : "exp.receivable")}
                      </span>
                      {settled && (
                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {t("exp.debtSettled")}
                        </span>
                      )}
                      {!settled && overdue(d) && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          {t("exp.overdue")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.dueDate ? `${t("exp.dueDate")}: ${d.dueDate}` : ""}
                      {d.note ? `${d.dueDate ? " · " : ""}${d.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <p className="text-sm font-bold tabular-nums">{money(remaining)}</p>
                    <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(d)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-destructive"
                      onClick={() => deleteDebt(d.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {!settled && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t("exp.paid")} {money(d.paid)} / {money(d.total)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 rounded-lg px-2.5 text-xs"
                      onClick={() => {
                        setPayFor(d);
                        setPayAmount(String(Math.max(0, remaining)));
                      }}
                    >
                      <HandCoins className="size-3.5" />
                      {t("exp.recordPayment")}
                    </Button>
                  </div>
                )}
              </div>
            </FadeIn>
          );
        })}
        {debts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
            <HandCoins className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("exp.addDebt")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("exp.debtsSub")}</p>
          </div>
        )}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("exp.editDebt") : t("exp.addDebt")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["payable", "receivable"] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setForm({ ...form, direction: dir })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    form.direction === dir
                      ? dir === "payable"
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t(dir === "payable" ? "exp.payable" : "exp.receivable")}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-name">{t("biz.name")}</Label>
              <Input
                id="debt-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl"
                autoFocus
              />
            </div>
            <MoneyInput
              label={t("biz.total")}
              valueUsd={form.total === "" ? null : Number(form.total)}
              onChangeUsd={(v) => setForm({ ...form, total: v === null ? "" : String(v) })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">{t("exp.dueDate")}</Label>
              <Input
                id="debt-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-note">{t("exp.note")}</Label>
              <Input
                id="debt-note"
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
            <Button onClick={save} disabled={!(form.name.trim() && Number(form.total) > 0)} className="rounded-xl">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("exp.recordPayment")}</DialogTitle>
          </DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{payFor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("exp.remaining")}: {money(payFor.total - payFor.paid)}
                </p>
              </div>
              <MoneyInput
                label={t("exp.paymentAmount")}
                valueUsd={payAmount === "" ? null : Number(payAmount)}
                onChangeUsd={(v) => setPayAmount(v === null ? "" : String(v))}
                autoFocus
              />
              <Button onClick={recordPayment} disabled={!(Number(payAmount) > 0)} className="w-full rounded-xl">
                {t("common.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
