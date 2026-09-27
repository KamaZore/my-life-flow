import { FadeIn, StatCard } from "@/components/systems/Shared";
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
import { addSalonCustomer, deleteSalonCustomer, updateSalonCustomer, useSalon } from "@/lib/store";
import { Pencil, Phone, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", phone: "", note: "" };

export default function SalonCustomers() {
  const { t } = useI18n();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const totalSpent = salon.customers.reduce((s, c) => s + c.spent, 0);
  const repeat = salon.customers.filter((c) => c.visits > 1).length;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(id: string) {
    const c = salon.customers.find((x) => x.id === id);
    if (!c) return;
    setEditing(id);
    setForm({ name: c.name, phone: c.phone ?? "", note: c.note ?? "" });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    const payload = { name, phone: form.phone.trim() || undefined, note: form.note.trim() || undefined };
    if (editing) {
      updateSalonCustomer(editing, payload);
    } else {
      addSalonCustomer(payload);
    }
    toast.success(t("salon.customerSaved"));
    setOpen(false);
  }

  function remove(id: string) {
    deleteSalonCustomer(id);
    toast.success(t("salon.customerDeleted"));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.customers")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.customersSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.addCustomer")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("salon.customers")} value={String(salon.customers.length)} icon={Users} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard label={t("salon.repeatCustomers")} value={String(repeat)} icon={UserRound} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.lifetimeSpent")} value={moneyShort(totalSpent)} icon={Users} tone="text-violet-600 dark:text-violet-400" tint="bg-violet-500/12" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {salon.customers.map((c, i) => (
          <FadeIn key={c.id} delay={i * 0.03}>
            <div className="card-soft flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/12 text-sm font-bold text-rose-600 dark:text-rose-400">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  {c.phone && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {c.phone}
                    </p>
                  )}
                  {c.note && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.note}</p>}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(c.id)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg text-destructive" onClick={() => remove(c.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                <span className="text-muted-foreground">
                  {t("salon.visits")}: <b className="text-foreground tabular-nums">{c.visits}</b>
                </span>
                <span className="text-muted-foreground">
                  {t("salon.spent")}: <b className="text-foreground tabular-nums">{money(c.spent)}</b>
                </span>
              </div>
              {c.lastVisit && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("salon.lastVisit")}: {c.lastVisit}
                </p>
              )}
            </div>
          </FadeIn>
        ))}
        {salon.customers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2 xl:col-span-3">
            <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.addCustomer")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.customersSub")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editCustomer") : t("salon.addCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-name">{t("biz.name")}</Label>
              <Input id="sc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-phone">{t("salon.phone")}</Label>
              <Input id="sc-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-xl" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-note">{t("exp.note")}</Label>
              <Input id="sc-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-10 rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">{t("common.cancel")}</Button>
            <Button onClick={save} disabled={!form.name.trim()} className="rounded-xl">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
