import { useAppData } from "./store";
import type { Currency } from "./types";

/**
 * Money formatting shared by the expense and business systems.
 *
 * Amounts are always STORED in USD. The display currency (USD or Cambodian
 * riel) is a user setting; these helpers convert for display only, so all
 * math (totals, reports, budgets, CSV) stays consistent.
 */

export const DEFAULT_USD_TO_KHR = 4100;
export const KHR_SYMBOL = "\u17DB"; // ៛

let displayCurrency: Currency = "USD";
let displayRate = DEFAULT_USD_TO_KHR;

function clampRate(rate: number | undefined): number {
  return typeof rate === "number" && rate >= 100 && rate <= 1_000_000
    ? rate
    : DEFAULT_USD_TO_KHR;
}

/**
 * Reactive currency state. Reading it also syncs the module-level values
 * used by the non-reactive `money()` helpers (CSV export, toasts, etc.),
 * so every consumer sees the same currency after a settings change.
 */
export function useCurrency(): { currency: Currency; usdToKhr: number } {
  const settings = useAppData().settings;
  displayCurrency = settings.currency ?? "USD";
  displayRate = clampRate(settings.usdToKhr);
  return { currency: displayCurrency, usdToKhr: displayRate };
}

/** Current display currency without the React subscription (for helpers). */
export function currentCurrency(): Currency {
  return displayCurrency;
}

/** Format an amount in the active display currency. */
export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (displayCurrency === "KHR") {
    const riel = Math.round(abs * displayRate);
    return `${sign}${KHR_SYMBOL}${riel.toLocaleString("en-US")}`;
  }
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}

/** Compact money for chart axes / small cards. */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (displayCurrency === "KHR") {
    const riel = Math.round(abs * displayRate);
    if (riel >= 1_000_000) return `${sign}${KHR_SYMBOL}${(riel / 1_000_000).toFixed(1)}M`;
    if (riel >= 10_000) return `${sign}${KHR_SYMBOL}${(riel / 1_000).toFixed(1)}K`;
    return `${sign}${KHR_SYMBOL}${riel.toLocaleString("en-US")}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return money(n);
}

/** Convert a USD amount to a formatted riel string (for "≈" hints). */
export function moneyKhr(usd: number): string {
  const riel = Math.round(Math.abs(usd) * displayRate);
  return `${usd < 0 ? "-" : ""}${KHR_SYMBOL}${riel.toLocaleString("en-US")}`;
}
