import { getData } from "./store";
import { todayKey, addDaysKey } from "./date-utils";
import { money } from "./format";
import type { SystemId } from "./types";

export type AppNotification = {
  id: string;
  system: SystemId;
  severity: "info" | "warning" | "danger";
  /** i18n key describing the alert kind (notif.*) */
  titleKey: string;
  /** entity name: product, debt, goal or customer */
  titleText: string;
  /** pre-rendered detail line (amounts, dates, times) */
  detail: string;
  /** route to open when tapped */
  to: string;
};

/**
 * Collects actionable alerts across systems: salon + business low stock,
 * salon bookings for today/tomorrow, overdue debts, budget overspend and
 * life goals due within a week. Recomputed on demand — cheap enough for a
 * badge and a dropdown.
 */
export function collectNotifications(): AppNotification[] {
  const out: AppNotification[] = [];
  const d = getData();
  const today = todayKey();
  const soon = addDaysKey(today, 2);
  const month = today.slice(0, 7);

  // Salon: low stock
  for (const p of d.salon.products) {
    if (p.stock <= p.lowStockThreshold) {
      out.push({
        id: `salon-low-${p.id}`,
        system: "salon",
        severity: p.stock === 0 ? "danger" : "warning",
        titleKey: "notif.lowStock",
        titleText: p.name,
        detail: p.stock === 0 ? "0" : `${p.stock}`,
        to: "/salon/products",
      });
    }
  }

  // Salon: today's + tomorrow's bookings
  for (const a of d.salon.appointments) {
    if (a.status !== "booked" || a.date < today || a.date > soon) continue;
    const svc = d.salon.services.find((s) => s.id === a.serviceId);
    out.push({
      id: `salon-appt-${a.id}`,
      system: "salon",
      severity: "info",
      titleKey: a.date === today ? "notif.bookingToday" : "notif.bookingSoon",
      titleText: a.customerName || d.salon.customers.find((c) => c.id === a.customerId)?.name || "—",
      detail: `${svc?.name ?? ""} · ${a.time}`,
      to: "/salon/appointments",
    });
  }

  // Business: low stock products
  for (const p of d.business.products) {
    if (p.stock <= p.lowStockThreshold) {
      out.push({
        id: `biz-low-${p.id}`,
        system: "business",
        severity: p.stock === 0 ? "danger" : "warning",
        titleKey: "notif.lowStock",
        titleText: p.name,
        detail: p.stock === 0 ? "0" : `${p.stock}`,
        to: "/business/inventory",
      });
    }
  }

  // Expense: overdue debts
  for (const debt of d.debts) {
    const remaining = debt.total - debt.paid;
    if (remaining <= 0) continue;
    if (debt.dueDate && debt.dueDate < today) {
      out.push({
        id: `debt-${debt.id}`,
        system: "expense",
        severity: "danger",
        titleKey: "notif.overdueDebt",
        titleText: debt.name,
        detail: money(remaining),
        to: "/expense/debts",
      });
    }
  }

  // Expense: budget overspend this month
  const spentByCat = new Map<string, number>();
  for (const tx of d.transactions) {
    if (tx.type !== "expense" || !tx.date.startsWith(month)) continue;
    spentByCat.set(tx.category, (spentByCat.get(tx.category) ?? 0) + tx.amount);
  }
  for (const [cat, budget] of Object.entries(d.budgets)) {
    if (!budget || budget <= 0) continue;
    const spent = spentByCat.get(cat) ?? 0;
    if (spent > budget) {
      out.push({
        id: `budget-${cat}`,
        system: "expense",
        severity: "warning",
        titleKey: "notif.budgetOver",
        titleText: cat,
        detail: `${money(spent)} / ${money(budget)}`,
        to: "/expense/categories",
      });
    }
  }

  // Life: goals due within 7 days
  for (const g of d.goals) {
    if (!g.targetDate || g.targetDate < today || g.targetDate > addDaysKey(today, 7)) continue;
    if (g.status !== "active") continue;
    out.push({
      id: `goal-${g.id}`,
      system: "life",
      severity: "info",
      titleKey: "notif.goalDue",
      titleText: g.title,
      detail: g.targetDate,
      to: "/life/goals",
    });
  }

  return out;
}
