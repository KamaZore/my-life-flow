import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { todayKey } from "@/lib/date-utils";
import { addTransaction } from "@/lib/store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/types";
import { ArrowDown, ArrowUp, Check, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Quick Money In/Out box (expense dashboard).
 *
 * One-card capture: type an amount (USD or ៛), tap IN or OUT, optionally a
 * one-word note, and it saves a real transaction — the same records the
 * Transactions page, Reports and budgets are built from. Defaults: IN →
 * salary / OUT → food, method cash, date today.
 */
export function QuickMoneyBox() {
  const { t } = useI18n();
  const [dir, setDir] = useState<"in" | "out">("out");
  const [amountUsd, setAmountUsd] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    if (!amountUsd || amountUsd <= 0) return;
    addTransaction({
      type: dir === "in" ? "income" : "expense",
      amount: Math.round(amountUsd * 100) / 100,
      category: dir === "in" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
      method: "cash",
      date: todayKey(),
      note: note.trim() || undefined,
    });
    toast.success(
      `${dir === "in" ? t("quick.income") : t("quick.expense")} · ${t("quick.savedToast")}`,
    );
    setAmountUsd(null);
    setNote("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <Card className="rounded-3xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="size-4" />
          </span>
          {t("quick.moneyTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <MoneyInput valueUsd={amountUsd} onChangeUsd={setAmountUsd} />

          {/* IN / OUT direction toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1 sm:w-44">
            <button
              type="button"
              onClick={() => setDir("in")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
                dir === "in"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDown className="size-4" />
              {t("quick.in")}
            </button>
            <button
              type="button"
              onClick={() => setDir("out")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
                dir === "out"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUp className="size-4" />
              {t("quick.out")}
            </button>
          </div>

          <Button
            onClick={save}
            disabled={!amountUsd || amountUsd <= 0}
            className={`h-11 gap-1.5 rounded-xl sm:w-28 ${
              saved ? "bg-emerald-600 hover:bg-emerald-600" : ""
            }`}
          >
            {saved ? <Check className="size-4" /> : <Zap className="size-4" />}
            {saved ? t("quick.done") : t("quick.save")}
          </Button>
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("quick.notePlaceholder")}
          className="mt-2 h-9 rounded-xl border-border/60 bg-background/60 text-sm"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </CardContent>
    </Card>
  );
}
