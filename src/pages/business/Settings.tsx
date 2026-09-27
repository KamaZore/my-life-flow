import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
import { updateBusinessSettings, useBusiness } from "@/lib/store";
import { Store } from "lucide-react";
import { useState } from "react";
import Settings from "@/pages/Settings";

/**
 * Business settings = the same shared settings page used by the other
 * systems, with the shop-specific card (name + tax) injected first so
 * every system's settings page looks and behaves identically.
 */
export default function BusinessSettings() {
  const { t } = useI18n();
  const business = useBusiness();
  const [shopName, setShopName] = useState(business.shopName);
  const [taxEnabled, setTaxEnabled] = useState(business.taxEnabled);
  const [taxRate, setTaxRate] = useState(String(business.taxRate));

  const extra = (
    <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
      <h2 className="pb-3 flex items-center gap-2 text-sm font-semibold">
        <Store className="size-4 text-primary" />
        {t("biz.shopName")}
      </h2>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="shop">{t("biz.shopName")}</Label>
          <Input
            id="shop"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="My Shop"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            {t("biz.receipt")}: {business.shopName || "Flowday"}
          </p>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
          <span className="text-sm font-medium">{t("biz.taxEnabled")}</span>
          <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
        </label>

        {taxEnabled && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tax">{t("biz.taxRate")}</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl"
              onClick={() =>
                updateBusinessSettings({
                  shopName: shopName.trim(),
                  taxEnabled,
                  taxRate: Math.max(0, Math.min(100, Number(taxRate) || 0)),
                })
              }
            >
              {t("common.save")}
            </Button>
          </div>
        )}

        {!taxEnabled && (
          <Button
            onClick={() =>
              updateBusinessSettings({
                shopName: shopName.trim(),
                taxEnabled,
                taxRate: Math.max(0, Math.min(100, Number(taxRate) || 0)),
              })
            }
            className="w-full rounded-xl"
          >
            {t("common.save")}
          </Button>
        )}

        {/* Tax applies on top of prices; show a live sample at the current rate. */}
        <p className="text-[11px] text-muted-foreground">
          {t("biz.taxRate")}: {business.taxRate}% · {money(10)} + {business.taxRate}% ={" "}
          {money(10 * (1 + business.taxRate / 100))}
        </p>
      </div>
    </section>
  );

  return <Settings extra={extra} />;
}
