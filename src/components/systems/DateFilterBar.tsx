import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import {
  DATE_FILTER_KINDS,
  resolveDateRange,
  type DateFilter,
  type DateFilterKind,
} from "@/lib/store";
import { CalendarDays, X } from "lucide-react";
import { useState } from "react";

const KINDS = DATE_FILTER_KINDS.filter((k) => k !== "custom");

const LABEL_KEYS: Record<DateFilterKind, string> = {
  today: "filter.today",
  yesterday: "filter.yesterday",
  week: "filter.week",
  month: "filter.month",
  lastMonth: "filter.lastMonth",
  year: "filter.year",
  all: "filter.all",
  custom: "filter.custom",
};

/**
 * Horizontal date-range filter. `all` shows only when `allowAll` (long
 * histories), custom adds a from/to picker inline.
 */
export function DateFilterBar({
  value,
  onChange,
  allowAll = true,
}: {
  value: DateFilter;
  onChange: (f: DateFilter) => void;
  allowAll?: boolean;
}) {
  const { t } = useI18n();
  const [showCustom, setShowCustom] = useState(value.kind === "custom");
  const kinds = allowAll ? KINDS : KINDS;

  const customActive = value.kind === "custom" && (value.from || value.to);

  return (
    <div className="space-y-2">
      <div className="-mx-2 overflow-x-auto px-2 pb-1 md:mx-0 md:px-0">
        <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {kinds.map((k) => (
            <Button
              key={k}
              type="button"
              variant={value.kind === k ? "default" : "outline"}
              size="sm"
              className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold"
              onClick={() => {
                onChange({ kind: k });
                setShowCustom(false);
              }}
            >
              {t(LABEL_KEYS[k])}
            </Button>
          ))}
          <Button
            type="button"
            variant={value.kind === "custom" ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold"
            onClick={() => {
              setShowCustom((v) => !v);
              if (!showCustom) onChange({ kind: "custom", from: undefined, to: undefined });
            }}
          >
            {t("filter.custom")}
          </Button>
        </div>
      </div>

      {showCustom && (
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <CalendarDays className="size-3" />
                {t("filter.from")}
              </span>
              <Input
                type="date"
                className="h-10 w-full rounded-xl text-sm"
                value={value.from ?? ""}
                onChange={(e) =>
                  onChange({ kind: "custom", from: e.target.value || undefined, to: value.to })
                }
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <CalendarDays className="size-3" />
                {t("filter.to")}
              </span>
              <Input
                type="date"
                className="h-10 w-full rounded-xl text-sm"
                value={value.to ?? ""}
                onChange={(e) =>
                  onChange({ kind: "custom", from: value.from, to: e.target.value || undefined })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 flex-1 rounded-xl text-xs sm:flex-none"
                onClick={() => {
                  const r = resolveDateRange({ kind: "month" });
                  onChange({ kind: "custom", ...r });
                }}
              >
                {t("filter.month")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl px-2.5 text-xs"
                onClick={() => {
                  onChange({ kind: "custom", from: undefined, to: undefined });
                }}
                aria-label={t("common.cancel")}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          {customActive && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <CalendarDays className="size-3" />
              {value.from ?? "…"} → {value.to ?? "…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
