import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, moneyKhr, currentCurrency } from "@/lib/format";
import { todayKey } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n";
import { checkoutSalonSale, useSalon } from "@/lib/store";
import { salonLineTotal, type SalonSaleLine } from "@/lib/types";
import { PAYMENT_METHODS } from "@/lib/types";
import {
  Banknote,
  CreditCard,
  Landmark,
  Minus,
  Package,
  Percent,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CartLine = SalonSaleLine & { key: string };

const METHOD_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  card: CreditCard,
  bank: Landmark,
  other: Wallet,
};

export default function SalonPOS() {
  const { t } = useI18n();
  const salon = useSalon();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [receipt, setReceipt] = useState<{ number: number; total: number; change: number } | null>(null);

  const q = search.trim().toLowerCase();
  const services = useMemo(
    () => salon.services.filter((s) => s.active !== false && (!q || s.name.toLowerCase().includes(q))),
    [salon.services, q],
  );
  const products = useMemo(
    () => salon.products.filter((p) => p.active !== false && (!q || p.name.toLowerCase().includes(q))),
    [salon.products, q],
  );

  const subtotal = Math.round(cart.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  const discountTotal =
    Math.round(cart.reduce((s, l) => s + (l.price * l.qty * l.discount) / 100, 0) * 100) / 100;
  const total = Math.round((subtotal - discountTotal) * 100) / 100;

  function addService(id: string) {
    const svc = salon.services.find((s) => s.id === id);
    if (!svc) return;
    setCart((c) => {
      const key = `svc-${id}`;
      const found = c.find((l) => l.key === key);
      if (found) return c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key, itemId: id, kind: "service", name: svc.name, price: svc.price, qty: 1, discount: 0 }];
    });
  }

  function addProduct(id: string) {
    const prod = salon.products.find((p) => p.id === id);
    if (!prod || prod.stock <= 0) return;
    setCart((c) => {
      const key = `prod-${id}`;
      const found = c.find((l) => l.key === key);
      const nextQty = (found?.qty ?? 0) + 1;
      if (nextQty > prod.stock) {
        toast.error(t("salon.outOfStock"));
        return c;
      }
      if (found) return c.map((l) => (l.key === key ? { ...l, qty: nextQty } : l));
      return [...c, { key, itemId: id, kind: "product", name: prod.name, price: prod.price, qty: 1, discount: 0 }];
    });
  }

  function setQty(key: string, qty: number) {
    setCart((c) => {
      if (qty <= 0) return c.filter((l) => l.key !== key);
      const line = c.find((l) => l.key === key);
      if (line?.kind === "product") {
        const prod = salon.products.find((p) => p.id === line.itemId);
        if (prod && qty > prod.stock) {
          toast.error(t("salon.outOfStock"));
          return c;
        }
      }
      return c.map((l) => (l.key === key ? { ...l, qty } : l));
    });
  }

  function setDiscount(key: string, pct: number) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, discount: Math.min(100, Math.max(0, pct)) } : l)));
  }

  function setLineStaff(key: string, staffId: string) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, staffId: staffId || undefined } : l)));
  }

  function openPay() {
    if (cart.length === 0) return;
    setAmountPaid("");
    setMethod("cash");
    setPayOpen(true);
  }

  function confirmPayment() {
    const paid = method === "cash" && amountPaid ? Number(amountPaid) : undefined;
    if (method === "cash" && paid !== undefined && paid < total) return;
    const sale = checkoutSalonSale({
      lines: cart.map(({ key: _key, ...l }) => l),
      customerId: customerId === "none" ? undefined : customerId,
      method: method as (typeof PAYMENT_METHODS)[number],
    });
    setPayOpen(false);
    setReceipt({ number: sale.number, total: sale.total, change: paid ? Math.round((paid - sale.total) * 100) / 100 : 0 });
    setCart([]);
    setCustomerId("none");
    toast.success(`${t("salon.saleDone")} · #${sale.number}`);
  }

  const change = method === "cash" && amountPaid ? Math.max(0, Number(amountPaid) - total) : 0;
  const today = todayKey();
  const todaySales = salon.sales.filter((s) => s.date === today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.pos")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("salon.receiptNum")} {salon.saleCounter + 1}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium">
          <Sparkles className="size-3.5 text-emerald-500" />
          {t("salon.todayRevenue")}: {money(todaySales.reduce((s, x) => s + x.total, 0))} · {todaySales.length} {t("salon.doneShort")}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Services & products */}
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("salon.searchCatalog")}
            className="h-11 rounded-xl"
            autoFocus
          />

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" />
              {t("nav.salon.services")}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addService(s.id)}
                  className="card-soft flex flex-col items-start gap-1.5 rounded-2xl border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-md"
                  style={s.color ? { borderColor: `${s.color}30` } : undefined}
                >
                  <span
                    className="flex size-7 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${s.color ?? "#ec4899"}1f`, color: s.color ?? "#ec4899" }}
                  >
                    <Sparkles className="size-4" />
                  </span>
                  <span className="line-clamp-2 min-h-8 text-sm font-semibold leading-snug">{s.name}</span>
                  <span className="text-sm font-bold text-primary">{money(s.price)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Package className="size-3.5" />
              {t("nav.salon.products")}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p.id)}
                  disabled={p.stock <= 0}
                  className="card-soft flex flex-col items-start gap-1.5 rounded-2xl border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-40"
                >
                  <span className="flex w-full items-start justify-between gap-1">
                    <span className="line-clamp-2 min-h-8 text-sm font-semibold leading-snug">{p.name}</span>
                    {p.stock <= p.lowStockThreshold && (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                        {p.stock}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-primary">{money(p.price)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t("salon.stock")}: {p.stock}
                  </span>
                </button>
              ))}
              {products.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                  {t("salon.noProducts")}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Cart */}
        <div className="card-soft flex h-fit flex-col rounded-3xl border border-border/60 bg-card lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <ShoppingBag className="size-4" />
              {t("biz.cart")}
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs text-muted-foreground" onClick={() => setCart([])}>
                <Trash2 className="size-3.5" />
                {t("salon.clear")}
              </Button>
            )}
          </div>

          <div className="max-h-[40vh] space-y-2 overflow-y-auto p-3">
            {cart.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("salon.emptyCart")}</p>
            )}
            {cart.map((l) => (
              <div key={l.key} className="rounded-2xl bg-muted/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold">
                    {l.kind === "service" ? <Sparkles className="size-3 shrink-0 text-muted-foreground" /> : <Package className="size-3 shrink-0 text-muted-foreground" />}
                    {l.name}
                  </p>
                  <button onClick={() => setQty(l.key, 0)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7 rounded-lg" onClick={() => setQty(l.key, l.qty - 1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                    <Button variant="outline" size="icon" className="size-7 rounded-lg" onClick={() => setQty(l.key, l.qty + 1)}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Percent className="size-3" />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={l.discount || ""}
                      placeholder="0"
                      onChange={(e) => setDiscount(l.key, Number(e.target.value) || 0)}
                      className="w-10 rounded-md bg-background px-1 py-0.5 text-center text-xs"
                    />
                    %
                  </div>
                  <span className="text-sm font-bold">{money(salonLineTotal(l))}</span>
                </div>
                {l.kind === "service" && salon.staff.length > 0 && (
                  <select
                    value={l.staffId ?? ""}
                    onChange={(e) => setLineStaff(l.key, e.target.value)}
                    className="mt-1.5 h-7 w-full rounded-lg border bg-background px-2 text-xs text-muted-foreground"
                  >
                    <option value="">{t("salon.anyStaff")}</option>
                    {salon.staff.filter((m) => m.active !== false).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border/60 px-4 py-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("biz.subtotal")}</span>
              <span>{money(subtotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("biz.discount")}</span>
                <span>−{money(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>{t("biz.total")}</span>
              <span className="text-primary">{money(total)}</span>
            </div>

            <div className="pt-1">
              <Label className="text-xs text-muted-foreground">{t("biz.selectCustomer")}</Label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border bg-background px-2 text-xs"
              >
                <option value="none">{t("salon.walkIn")}</option>
                {salon.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Button onClick={openPay} disabled={cart.length === 0} className="h-11 w-full rounded-xl text-base font-bold">
              {t("biz.charge")} · {money(total)}
            </Button>
            {cart.length > 0 && currentCurrency() === "USD" && (
              <p className="text-center text-xs text-muted-foreground">≈ {moneyKhr(total)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("biz.charge")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-center text-3xl font-bold text-primary">{money(total)}</p>
            {currentCurrency() === "USD" && (
              <p className="text-center text-sm text-muted-foreground">≈ {moneyKhr(total)}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICON[m] ?? Wallet;
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={
                      "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors " +
                      (method === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:bg-accent")
                    }
                  >
                    <Icon className="size-4" />
                    {t(`pay.${m}`)}
                  </button>
                );
              })}
            </div>
            {method === "cash" && (
              <div className="space-y-1.5">
                <Label htmlFor="salon-paid">{t("biz.amountPaid")}</Label>
                <Input
                  id="salon-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-11 rounded-xl text-lg font-semibold"
                  inputMode="decimal"
                />
                {change > 0 && (
                  <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("biz.change")}: {money(change)}
                  </p>
                )}
              </div>
            )}
            <Button
              onClick={confirmPayment}
              disabled={method === "cash" && Boolean(amountPaid) && Number(amountPaid) < total}
              className="h-11 w-full rounded-xl text-base font-bold"
            >
              {t("biz.charge")} · {money(total)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={Boolean(receipt)} onOpenChange={(v) => !v && setReceipt(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("biz.receipt")}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-2 text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{money(receipt.total)}</p>
              <p className="text-xs text-muted-foreground">#{receipt.number}</p>
              {receipt.change > 0 && (
                <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {t("biz.change")}: {money(receipt.change)}
                </p>
              )}
              <Button className="w-full rounded-xl" onClick={() => setReceipt(null)}>
                {t("common.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
