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
import { ImagePicker } from "@/components/systems/ImagePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  addSalonProduct,
  useSalon,
  adjustSalonStock,
  deleteSalonProduct,
  updateSalonProduct,
  useSalonProducts,
} from "@/lib/store";
import { Package, PackagePlus, Pencil, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  price: "",
  cost: "",
  stock: "0",
  lowStockThreshold: "3",
  categoryId: "",
  sku: "",
  image: "",
};

export default function SalonProducts() {
  const { t } = useI18n();
  const products = useSalonProducts();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold).length;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setEditing(id);
    setForm({
      name: p.name,
      price: String(p.price),
      cost: p.cost ? String(p.cost) : "",
      stock: String(p.stock),
      lowStockThreshold: String(p.lowStockThreshold),
      categoryId: p.categoryId ?? "",
      sku: p.sku ?? "",
      image: p.image ?? "",
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
      cost: form.cost ? Math.round(Number(form.cost) * 100) / 100 : undefined,
      stock: Math.max(0, Math.round(Number(form.stock) || 0)),
      lowStockThreshold: Math.max(0, Math.round(Number(form.lowStockThreshold) || 0)),
      categoryId: form.categoryId || undefined,
      sku: form.sku.trim() || undefined,
      image: form.image || undefined,
      active: true,
    };
    if (editing) updateSalonProduct(editing, payload);
    else addSalonProduct(payload);
    toast.success(t("salon.productSaved"));
    setOpen(false);
  }

  function restock(id: string, delta: number) {
    const next = adjustSalonStock(id, delta);
    toast.success(`${t("salon.stock")}: ${next}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.products")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.productsSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.addProduct")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("nav.salon.products")} value={String(products.length)} icon={Package} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("salon.stockValue")} value={moneyShort(stockValue)} icon={PackagePlus} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.lowStock")} value={String(lowStock)} icon={TriangleAlert} tone={lowStock > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"} tint={lowStock > 0 ? "bg-amber-500/12" : "bg-muted"} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p, i) => (
          <FadeIn key={p.id} delay={i * 0.03}>
            <div className="card-soft flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                {p.image ? (
                  <img src={p.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-2xl object-cover ring-1 ring-border/60" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                    <Package className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku ? `${p.sku} · ` : ""}
                    {t("salon.stock")}:{" "}
                    <b className={p.stock <= p.lowStockThreshold ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>
                      {p.stock}
                    </b>
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => openEdit(p.id)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg text-destructive" onClick={() => { deleteSalonProduct(p.id); toast.success(t("salon.productDeleted")); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                <p className="text-base font-bold tabular-nums">{money(p.price)}</p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={() => restock(p.id, -1)}>
                    −1
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg px-2 text-xs" onClick={() => restock(p.id, +1)}>
                    <PackagePlus className="size-3" />
                    +1
                  </Button>
                </div>
              </div>
              {p.stock <= p.lowStockThreshold && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3" />
                  {t("salon.lowStockWarning")}
                </p>
              )}
            </div>
          </FadeIn>
        ))}
        {products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center sm:col-span-2 xl:col-span-3">
            <Package className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.addProduct")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.productsSub")}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editProduct") : t("salon.addProduct")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-name">{t("salon.productName")}</Label>
              <Input id="sp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" autoFocus />
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="sp-stock">{t("salon.stock")}</Label>
                <Input id="sp-stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-10 rounded-xl" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-low">{t("salon.lowStockAt")}</Label>
                <Input id="sp-low" type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="h-10 rounded-xl" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-sku">{t("salon.sku")}</Label>
              <Input id="sp-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="h-10 rounded-xl" placeholder="SH-250" />
            </div>
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
