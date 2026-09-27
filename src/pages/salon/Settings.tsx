import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { updateSalonSettings, useSalon } from "@/lib/store";
import { Scissors } from "lucide-react";
import { useState } from "react";
import Settings from "@/pages/Settings";

/** Salon settings = shared settings page + salon shop card (same pattern as Business). */
export default function SalonSettings() {
  const { t } = useI18n();
  const salon = useSalon();
  const [shopName, setShopName] = useState(salon.shopName);

  const extra = (
    <section className="card-soft rounded-2xl border border-border/70 bg-card p-4">
      <h2 className="pb-3 flex items-center gap-2 text-sm font-semibold">
        <Scissors className="size-4 text-primary" />
        {t("salon.shopName")}
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="salon-shop">{t("salon.shopName")}</Label>
        <div className="flex items-end gap-2">
          <Input
            id="salon-shop"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Glow Salon"
            className="h-10 rounded-xl"
          />
          <Button
            className="rounded-xl"
            onClick={() => updateSalonSettings({ shopName: shopName.trim() })}
          >
            {t("common.save")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("salon.services")}: {salon.services.length} · {t("salon.staff")}: {salon.staff.length} ·{" "}
          {t("salon.customers")}: {salon.customers.length}
        </p>
      </div>
    </section>
  );

  return <Settings extra={extra} />;
}
