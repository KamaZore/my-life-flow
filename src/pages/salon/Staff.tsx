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
import { Switch } from "@/components/ui/switch";
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { addSalonStaff, deleteSalonStaff, updateSalonStaff, useSalon } from "@/lib/store";
import { Phone, Pencil, Plus, Trash2, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", role: "", phone: "", commission: "30", active: true };

export default function SalonStaff() {
  const { t } = useI18n();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const active = salon.staff.filter((s) => s.active !== false);
  const avgCommission =
    salon.staff.length > 0
      ? Math.round(salon.staff.reduce((s, x) => s + x.commission, 0) / salon.staff.length)
      : 0;

  // This month's service revenue per staff member (from walk-in sales)
  const month = new Date().toISOString().slice(0, 7);
  const revenueByStaff = new Map<string, number>();
  for (const sale of salon.sales) {
    if (!sale.date.startsWith(month)) continue;
    for (const l of sale.lines) {
      if (l.kind !== "service" || !l.staffId) continue;
      revenueByStaff.set(l.staffId, (revenueByStaff.get(l.staffId) ?? 0) + l.price * l.qty);
    }
  }
  const monthDone = [...revenueByStaff.values()].reduce((s, v) => s + v, 0);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(id: string) {
    const m = salon.staff.find((x) => x.id === id);
    if (!m) return;
    setEditing(id);
    setForm({
      name: m.name,
      role: m.role ?? "",
      phone: m.phone ?? "",
      commission: String(m.commission),
      active: m.active !== false,
    });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    const payload = {
      name,
      role: form.role.trim() || undefined,
      phone: form.phone.trim() || undefined,
      commission: Math.max(0, Math.min(100, Number(form.commission) || 0)),
      active: form.active,
    };
    if (editing) updateSalonStaff(editing, payload);
    else addSalonStaff(payload);
    toast.success(t("salon.staffSaved"));
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.staff")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.staffSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.addStaff")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("salon.staff")} value={String(salon.staff.length)} icon={Users} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("salon.activeStaff")} value={String(active.length)} icon={UserCog} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.monthDone")} value={moneyShort(monthDone)} icon={UserCog} tone="text-violet-600 dark:text-violet-400" tint="bg-violet-500/12" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {salon.staff.map((m, i) => {
          const rev = revenueByStaff.get(m.id) ?? 0;
          return (
            <FadeIn key={m.id} delay={i * 0.03}>
              <div className={`card-soft flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4 ${m.active === false ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-sm font-bold text-violet-600 dark:text-violet-400">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    {m.role && <p className="truncate text-xs text-muted-foreground">{m.role}</p>}
                    {m.phone && (
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {m.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(m.id)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 rounded-lg text-destructive" onClick={() => { deleteSalonStaff(m.id); toast.success(t("salon.staffDeleted")); }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    {t("salon.commission")}: <b className="text-foreground tabular-nums">{m.commission}%</b>
                  </span>
                  <span className="text-muted-foreground">
                    {t("salon.monthDone")}: <b className="text-foreground tabular-nums">{money(rev)}</b>
                  </span>
                </div>
              </div>
            </FadeIn>
          );
        })}
        {salon.staff.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2 xl:col-span-3">
            <UserCog className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.addStaff")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.staffSub")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editStaff") : t("salon.addStaff")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ss-name">{t("biz.name")}</Label>
              <Input id="ss-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss-role">{t("salon.role")}</Label>
              <Input id="ss-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 rounded-xl" placeholder="Stylist, Colorist…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss-phone">{t("salon.phone")}</Label>
              <Input id="ss-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-xl" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss-comm">{t("salon.commission")} (%)</Label>
              <Input
                id="ss-comm"
                type="number"
                min="0"
                max="100"
                value={form.commission}
                onChange={(e) => setForm({ ...form, commission: e.target.value })}
                className="h-10 rounded-xl"
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("salon.avgCommission")}: {avgCommission}%
              </p>
            </div>
            <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
              <span className="text-sm font-medium">{t("salon.activeStaff")}</span>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </label>
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
