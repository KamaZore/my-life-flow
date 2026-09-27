import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/store";
import { DEFAULT_USD_TO_KHR, KHR_SYMBOL } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Amount input that accepts EITHER USD or Cambodian riel.
 *
 * The user types in whichever currency they think in and taps the toggle;
 * the other side shows a live converted preview. The value handed to
 * `onChange` is ALWAYS in USD (the stored currency), so no caller math
 * changes — only the typing experience does.
 *
 * Rounding: riel has no subunits, so riel input is divided by the rate and
 * rounded to 2 decimals (cents). USD→KHR previews round to whole riel.
 */
export function MoneyInput({
  id,
  valueUsd,
  onChangeUsd,
  min = "0",
  autoFocus,
  placeholder,
  label,
}: {
  id?: string;
  /** current amount in USD (the stored currency) */
  valueUsd: number | null;
  onChangeUsd: (usd: number | null) => void;
  min?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Optional custom label; defaults to the generic "Amount". */
  label?: string;
}) {
  const { t } = useI18n();
  const settings = useSettings();
  const rate = settings.usdToKhr && settings.usdToKhr >= 100 ? settings.usdToKhr : DEFAULT_USD_TO_KHR;

  /** Which currency the user is typing in right now. */
  const [cur, setCur] = useState<"USD" | "KHR">("USD");
  /** Raw text in the ACTIVE currency (kept as text so typing feels normal). */
  const [text, setText] = useState("");
  /** The USD value we last pushed up ourselves — lets the sync effect below
   * ignore our own echoes (which would otherwise rewrite mid-typing text,
   * e.g. turning 10000៛ into 10004៛ or 2៛ into 0 while the user types). */
  const lastEmitted = useRef<number | null>(null);

  // Keep the visible text in sync when the same USD value changes from
  // outside (edit dialogs, clearing the form). Number inputs re-render as
  // plain strings; trailing "." during typing is preserved.
  useEffect(() => {
    // Our own echo: the parent re-rendered with exactly what we emitted.
    // Leave the user's text alone.
    if (valueUsd !== null && valueUsd === lastEmitted.current) return;

    const asText = valueUsd === null || Number.isNaN(valueUsd) ? "" : String(valueUsd);
    if (cur === "USD") {
      setText((prev) => {
        if (prev === asText) return prev;
        const asNum = Number(asText);
        if (Number(prev) === asNum && prev !== "" && asText !== "") return prev;
        return asText;
      });
    } else {
      const khr = valueUsd === null ? "" : String(Math.round(valueUsd * rate));
      setText((prev) => {
        if (prev === khr) return prev;
        const asNum = Number(khr);
        if (Number(prev) === asNum && prev !== "" && khr !== "") return prev;
        return khr;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueUsd, cur, rate]);

  /** USD value the current text represents (null when invalid/empty). */
  const usdFromText = useMemo(() => {
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) return null;
    return cur === "USD" ? Math.round(n * 100) / 100 : Math.round((n / rate) * 100) / 100;
  }, [text, cur, rate]);

  function emit(next: string, currency: "USD" | "KHR") {
    setText(next);
    if (!next) {
      lastEmitted.current = null;
      onChangeUsd(null);
      return;
    }
    const n = Number(next);
    if (!Number.isFinite(n) || n < 0) return;
    const usd = currency === "USD" ? Math.round(n * 100) / 100 : Math.round((n / rate) * 100) / 100;
    lastEmitted.current = usd;
    onChangeUsd(usd);
  }

  function switchTo(next: "USD" | "KHR") {
    if (next === cur) return;
    // Convert the currently typed amount into the other currency so the
    // user sees their number survive the switch.
    if (text && usdFromText !== null) {
      const converted =
        next === "KHR" ? String(Math.round(usdFromText * rate)) : String(Math.round(usdFromText * 100) / 100);
      setText(converted);
    }
    // The USD value itself didn't change — mark it as our own echo so the
    // sync effect doesn't re-convert the text we just wrote.
    lastEmitted.current = usdFromText;
    setCur(next);
  }

  const otherCur = cur === "USD" ? "KHR" : "USD";
  const preview =
    usdFromText === null
      ? ""
      : otherCur === "KHR"
        ? `${KHR_SYMBOL}${Math.round(usdFromText * rate).toLocaleString("en-US")}`
        : `$${(Math.round(usdFromText * 100) / 100).toFixed(2)}`;

  const isKhr = cur === "KHR";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {label ? (
          id ? (
            <label htmlFor={id} className="text-sm font-medium leading-none">{label}</label>
          ) : (
            <span className="text-sm font-medium leading-none">{label}</span>
          )
        ) : id ? (
          <label htmlFor={id} className="text-sm font-medium leading-none">{t("exp.amount")}</label>
        ) : (
          <span className="text-sm font-medium leading-none">{t("exp.amount")}</span>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label={t("cur.toggle")}>
          <button
            type="button"
            onClick={() => switchTo("USD")}
            className={`rounded-md px-2 py-0.5 text-xs font-bold transition-colors ${
              cur === "USD" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => switchTo("KHR")}
            className={`rounded-md px-2 py-0.5 text-xs font-bold transition-colors ${
              cur === "KHR" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {KHR_SYMBOL}
          </button>
        </div>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
          {isKhr ? KHR_SYMBOL : "$"}
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={isKhr ? "1" : "0.01"}
          required
          value={text}
          onChange={(e) => emit(e.target.value, cur)}
          placeholder={placeholder ?? (isKhr ? "0" : "0.00")}
          className="h-11 rounded-xl pl-8 text-lg font-semibold"
          autoFocus={autoFocus}
        />
        {/* Quick add chips: +1 +5 +10 in USD-equivalents (or 1000/5000 in KHR) */}
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
          {(isKhr ? [1000, 5000, 10000] : [1, 5, 10]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                const base = Number(text) || 0;
                emit(String(Math.round((base + n) * 100) / 100), cur);
              }}
              className="flex h-6 items-center gap-0.5 rounded-md bg-muted px-1.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-2.5" />
              {n.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      </div>
      {preview && (
        <p className="text-[11px] text-muted-foreground">
          ≈ {preview} · {t("cur.rate")} 1$ = {rate.toLocaleString("en-US")}{KHR_SYMBOL}
        </p>
      )}
    </div>
  );
}

/** Small helper for pages that only need minus/plus style amount steppers. */
export function QuickStepButtons({ onStep }: { onStep: (delta: number) => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
