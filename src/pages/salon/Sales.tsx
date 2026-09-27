import { FadeIn, StatCard } from "@/components/systems/Shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, moneyShort } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { deleteSalonSale, useSalon } from "@/lib/store";
import { salonLineTotal, type SalonSale } from "@/lib/types";
import {
  Banknote,
  CreditCard,
  Landmark,
  Receipt,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const METHOD_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  card: CreditCard,
  bank: Landmark,
  other: Wallet,
};

export default function SalonSales() {
  const { t } = useI18n();
  const salon = useSalon();
  const [detail, setDetail] = useState<SalonSale | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todayTotal = salon.sales.filter((s) => s.date === today).reduce((s, x) => s + x.total, 0);
  const monthTotal = salon.sales.filter((s) => s.date.startsWith(month)).reduce((s, x) => s + x.total, 0);
  const avgTicket = salon.sales.length ? monthTotal / salon.sales.filter((s) => s.date.startsWith(month)).length : 0;

  const custName = (id?: string) => salon.customers.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.sales")}</h1>
        <p className="text-sm text-muted-foreground">{t("salon.salesSub")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("salon.todayRevenue")} value={moneyShort(todayTotal)} icon={Receipt} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" />
        <StatCard label={t("salon.monthRevenue")} value={moneyShort(monthTotal)} icon={Receipt} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard label={t("salon.avgTicket")} value={moneyShort(avgTicket)} icon={ShoppingBag} tone="text-violet-600 dark:text-violet-400" tint="bg-violet-500/12" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="space-y-2">
        {salon.sales.map((s, i) => {
          const Icon = METHOD_ICON[s.method] ?? Wallet;
          return (
            <FadeIn key={s.id} delay={Math.min(i * 0.02, 0.2)}>
              <div className="card-soft flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold">#{s.number}</p>
                    <span className="text-xs text-muted-foreground">{s.date}</span>
                    {s.customerId && (
                      <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        {custName(s.customerId)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.lines.map((l) => `${l.name}×${l.qty}`).join(", ")}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums">{money(s.total)}</p>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" onClick={() => setDetail(s)}>
                  <Receipt className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg text-destructive" onClick={() => { deleteSalonSale(s.id); toast.success(t("salon.saleDeleted")); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </FadeIn>
          );
        })}
        {salon.sales.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
            <Receipt className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("salon.noSales")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("salon.salesSub")}</p>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("biz.receipt")} #{detail?.number}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">{detail.date}</p>
              <div className="space-y-2">
                {detail.lines.map((l, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {l.kind === "service" ? <Sparkles className="size-3 shrink-0 text-muted-foreground" /> : <ShoppingBag className="size-3 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{l.name} ×{l.qty}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(salonLineTotal(l))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t border-border/60 pt-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("biz.subtotal")}</span>
                  <span>{money(detail.subtotal)}</span>
                </div>
                {detail.discountTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("biz.discount")}</span>
                    <span>−{money(detail.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>{t("biz.total")}</span>
                  <span className="text-primary">{money(detail.total)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
