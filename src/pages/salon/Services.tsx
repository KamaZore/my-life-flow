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
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/format";
import { ImagePicker } from "@/components/systems/ImagePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { addSalonService, deleteSalonService, updateSalonService, useSalon } from "@/lib/store";
import { SALON_SERVICE_COLORS, type SalonService } from "@/lib/types";
import { Clock, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  price: "",
  duration: "30",
  categoryId: "",
  image: "",
  color: SALON_SERVICE_COLORS[0],
  active: true,
};

export default function SalonServices() {
  const { t } = useI18n();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalonService | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeCount = salon.services.filter((s) => s.active !== false).length;
  const avgPrice =
    salon.services.length > 0
      ? salon.services.reduce((s, x) => s + x.price, 0) / salon.services.length
      : 0;

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, color: SALON_SERVICE_COLORS[salon.services.length % SALON_SERVICE_COLORS.length] });
    setOpen(true);
  }

  function openEdit(s: SalonService) {
    setEditing(s);
    setForm({
      name: s.name,
      price: String(s.price),
      duration: String(s.duration),
      categoryId: s.categoryId ?? "",
      image: s.image ?? "",
      color: s.color ?? SALON_SERVICE_COLORS[0],
      active: s.active !== false,
    });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name || !(price > 0)) return;
    const payload = {
      name,
      price: Math.round(price * 100) / 100,
      duration: Math.max(5, Math.round(Number(form.duration) || 30)),
      categoryId: form.categoryId || undefined,
      image: form.image || undefined,
      color: form.color,
      active: form.active,
    };
    if (editing) updateSalonService(editing.id, payload);
    else addSalonService(payload);
    toast.success(t("salon.serviceSaved"));
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.services")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.servicesSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.addService")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("salon.services")} value={String(salon.services.length)} icon={Sparkles} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("salon.activeServices")} value={String(activeCount)} icon={Sparkles} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.avgPrice")} value={money(avgPrice)} icon={Sparkles} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {salon.services.map((s, i) => (
          <FadeIn key={s.id} delay={i * 0.03}>
            <div className={`card-soft flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4 ${s.active === false ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                {s.image ? (
                  <img src={s.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-2xl object-cover ring-1 ring-border/60" />
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${s.color ?? "#ec4899"}1f`, color: s.color ?? "#ec4899" }}
                  >
                    <Sparkles className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {s.duration} {t("salon.minutes")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(s)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg text-destructive" onClick={() => { deleteSalonService(s.id); toast.success(t("salon.serviceDeleted")); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <p className="text-base font-bold tabular-nums">{money(s.price)}</p>
                {s.active === false && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {t("salon.inactive")}
                  </span>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
        {salon.services.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2 xl:col-span-3">
            <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.addService")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.servicesSub")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editService") : t("salon.addService")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sv-name">{t("salon.serviceName")}</Label>
              <Input id="sv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" autoFocus />
            </div>
            <MoneyInput
              label={t("biz.total")}
              valueUsd={form.price === "" ? null : Number(form.price)}
              onChangeUsd={(v) => setForm({ ...form, price: v === null ? "" : String(v) })}
            />
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <ImagePicker value={form.image} onChange={(v) => setForm({ ...form, image: v ?? "" })} size="sm" />
              <div className="space-y-1.5">
                <Label>{t("salon.category")}</Label>
                <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("salon.noCategory")}</SelectItem>
                    {salon.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-dur">{t("salon.duration")}</Label>
              <Input
                id="sv-dur"
                type="number"
                min="5"
                step="5"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="h-10 rounded-xl"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sav.color")}</Label>
              <div className="flex gap-2">
                {SALON_SERVICE_COLORS.map((c) => (
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
            <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
              <span className="text-sm font-medium">{t("salon.serviceActive")}</span>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">{t("common.cancel")}</Button>
            <Button onClick={save} disabled={!(form.name.trim() && Number(form.price) > 0)} className="rounded-xl">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
