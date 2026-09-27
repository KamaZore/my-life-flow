import { ImagePicker } from "@/components/systems/ImagePicker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { todayKey } from "@/lib/date-utils";
import {
  addTransaction,
  updateTransaction,
} from "@/lib/store";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type Transaction,
} from "@/lib/types";
import { useEffect, useState } from "react";

/**
 * Create or edit a transaction. On create the dialog opens pre-set to
 * expense/food/cash/today so a fast "log lunch" takes seconds.
 */
export function TransactionDialog({
  open,
  onOpenChange,
  editing,
  defaultType = "expense",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Transaction | null;
  defaultType?: "income" | "expense";
}) {
  const { t, lang } = useI18n();
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [method, setMethod] = useState<string>("cash");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setMethod(editing.method);
      setDate(editing.date);
      setNote(editing.note ?? "");
      setImage(editing.image);
    } else {
      setType(defaultType);
      setAmount("");
      setCategory(defaultType === "expense" ? "food" : "salary");
      setMethod("cash");
      setDate(todayKey());
      setNote("");
      setImage(undefined);
    }
  }, [open, editing, defaultType]);

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function handleSave() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const input = {
      type,
      amount: Math.round(value * 100) / 100,
      category,
      method: method as Transaction["method"],
      date,
      note: note.trim() || undefined,
      image,
    };
    if (editing) updateTransaction(editing.id, input);
    else addTransaction(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("exp.edit") : t("exp.new")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Income / Expense toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1">
            {(["expense", "income"] as const).map((tx) => (
              <button
                key={tx}
                type="button"
                onClick={() => {
                  setType(tx);
                  setCategory(tx === "expense" ? "food" : "salary");
                }}
                className={cnType(type === tx)}
              >
                {tx === "expense" ? t("exp.type.expense") : lang === "km" ? "ចំណូលរកបាន" : t("exp.type.income")}
              </button>
            ))}
          </div>

          <MoneyInput
            id="tx-amount"
            valueUsd={amount === "" ? null : Number(amount)}
            onChangeUsd={(v) => setAmount(v === null ? "" : String(v))}
            autoFocus
          />

          <div className="grid grid-cols-1 gap-3 max-[380px]:grid-cols-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("exp.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`exp.cat.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("exp.method")}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`pay.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-date">{t("exp.date")}</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">{t("exp.note")}</Label>
            <Textarea
              id="tx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-xl"
              placeholder="…"
            />
          </div>

          {/* Receipt / proof photo */}
          <div className="space-y-1.5">
            <Label>{t("img.receipt")}</Label>
            <div className="flex items-center gap-3">
              <ImagePicker value={image} onChange={setImage} size="sm" />
              <p className="text-xs text-muted-foreground">{t("img.receiptHint")}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!Number(amount)} className="rounded-xl">
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnType(active: boolean): string {
  return [
    "rounded-xl py-2 text-sm font-semibold transition-colors",
    active
      ? "bg-background shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}
