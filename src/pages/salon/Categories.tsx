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
import { useI18n } from "@/lib/i18n";
import { addSalonCategory, deleteSalonCategory, updateSalonCategory, useSalon } from "@/lib/store";
import { SALON_SERVICE_COLORS } from "@/lib/types";
import { FolderOpen, Package, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", color: SALON_SERVICE_COLORS[0] };

export default function SalonCategories() {
  const { t } = useI18n();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const svcCount = (id: string) => salon.services.filter((s) => s.categoryId === id).length;
  const prodCount = (id: string) => salon.products.filter((p) => p.categoryId === id).length;

  function openAdd() {
    setEditing(null);
    setForm({ name: "", color: SALON_SERVICE_COLORS[salon.categories.length % SALON_SERVICE_COLORS.length] });
    setOpen(true);
  }

  function openEdit(id: string) {
    const c = salon.categories.find((x) => x.id === id);
    if (!c) return;
    setEditing(id);
    setForm({ name: c.name, color: c.color ?? SALON_SERVICE_COLORS[0] });
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    if (editing) updateSalonCategory(editing, { name, color: form.color });
    else addSalonCategory({ name, color: form.color });
    toast.success(t("salon.categorySaved"));
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.categories")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.categoriesSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.addCategory")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <StatCard label={t("nav.salon.categories")} value={String(salon.categories.length)} icon={FolderOpen} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("nav.salon.services")} value={String(salon.services.length)} icon={Scissors} tone="text-violet-600 dark:text-violet-400" tint="bg-violet-500/12" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {salon.categories.map((c, i) => (
          <FadeIn key={c.id} delay={i * 0.03}>
            <div className="card-soft flex h-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${c.color ?? "#ec4899"}1f`, color: c.color ?? "#ec4899" }}
              >
                <FolderOpen className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Scissors className="size-3" />
                    {svcCount(c.id)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="size-3" />
                    {prodCount(c.id)}
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" onClick={() => openEdit(c.id)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-lg text-destructive"
                onClick={() => {
                  deleteSalonCategory(c.id);
                  toast.success(t("salon.categoryDeleted"));
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </FadeIn>
        ))}
        {salon.categories.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2 xl:col-span-3">
            <FolderOpen className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.addCategory")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.categoriesSub")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editCategory") : t("salon.addCategory")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-name">{t("salon.categoryName")}</Label>
              <Input id="sc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" autoFocus />
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
