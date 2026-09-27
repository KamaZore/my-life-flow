import { FadeIn, StatCard } from "@/components/systems/Shared";
import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { addAccount, deleteAccount, updateAccount, useAccounts } from "@/lib/store";
import { ACCOUNT_KINDS, type Account } from "@/lib/types";
import { Banknote, CreditCard, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const KIND_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  bank: Landmark,
  card: CreditCard,
  mobile: Smartphone,
  other: Wallet,
};

const KIND_TINT: Record<string, string> = {
  cash: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  bank: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  card: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  mobile: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

const emptyForm = { name: "", kind: "cash", balance: "" };

export default function ExpenseAccounts() {
  const { t } = useI18n();
  const accounts = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);

  const total = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({ name: a.name, kind: a.kind, balance: String(a.balance) });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    const balance = Number(form.balance) || 0;
    if (editing) {
      updateAccount(editing.id, { name, kind: form.kind as Account["kind"], balance });
      toast.success(t("exp.accountSaved"));
    } else {
      addAccount({ name, kind: form.kind as Account["kind"], balance });
      toast.success(t("exp.accountSaved"));
    }
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("exp.accounts")}</h1>
          <p className="text-sm text-muted-foreground">{t("exp.accountsSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("exp.addAccount")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("exp.totalBalance")} value={money(total)} icon={Wallet} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("exp.accounts")} value={String(accounts.length)} icon={CreditCard} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a, i) => {
          const Icon = KIND_ICON[a.kind] ?? Wallet;
          return (
            <FadeIn key={a.id} delay={i * 0.03}>
              <Card className="card-soft h-full rounded-2xl">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${KIND_TINT[a.kind] ?? KIND_TINT.other}`}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{t(`exp.kind.${a.kind}`)}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${a.balance < 0 ? "text-destructive" : ""}`}>
                      {money(a.balance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(a)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-destructive"
                      onClick={() => deleteAccount(a.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
        {accounts.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border/70 p-10 text-center">
            <Wallet className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("exp.addAccount")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("exp.editAccount") : t("exp.addAccount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">{t("biz.name")}</Label>
              <Input
                id="acc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("exp.accountType")}</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`exp.kind.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <MoneyInput
              valueUsd={form.balance === "" ? null : Number(form.balance)}
              onChangeUsd={(v) => setForm({ ...form, balance: v === null ? "" : String(v) })}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!form.name.trim()} className="rounded-xl">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
