import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One-shot entrance used by list/grid items across the three systems. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Colored KPI tile with icon + value + optional sub-line. `tone` picks the
 * icon color; `tint` optionally washes the icon chip with the same hue.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
  tint,
  sub,
  delay = 0,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
  tint?: string;
  sub?: string;
  delay?: number;
  /** Extra classes for the wrapper (e.g. col-span within the stat grid). */
  className?: string;
}) {
  return (
    <FadeIn delay={delay} className={className}>
      <Card className="card-soft rounded-2xl border-border/60 transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted sm:size-10",
              tint,
              tone,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
            <p className="truncate text-base font-bold leading-tight tracking-tight sm:text-lg">{value}</p>
            {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

/** Friendly empty state with icon, title and optional hint. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <FadeIn className="col-span-full">
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-7 text-muted-foreground/60" />
        </span>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </FadeIn>
  );
}
