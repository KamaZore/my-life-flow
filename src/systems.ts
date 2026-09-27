import {
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  Database,
  FileText,
  HandCoins,
  HeartPulse,
  Scissors,
  Sparkles,
  Inbox,
  LayoutDashboard,
  LayoutList,
  LineChart,
  ListChecks,
  Package,
  PiggyBank,
  Receipt,
  Repeat2,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";
import type { SystemId } from "./lib/types";

export type NavItem = {
  labelKey: string;
  path: string;
  icon: LucideIcon;
};

export type SystemDef = {
  id: SystemId;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
  /** tailwind classes for the selector card accent */
  accent: string; // text + icon color
  ring: string; // selected ring/border
  glow: string; // soft bg wash
  root: string; // route root
  nav: NavItem[];
};

export const SYSTEMS: SystemDef[] = [
  {
    id: "life",
    labelKey: "system.life.name",
    descKey: "system.life.desc",
    icon: HeartPulse,
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/60 bg-emerald-500/5",
    glow: "from-emerald-500/15",
    root: "/life",
    nav: [
      { labelKey: "nav.today", path: "/life/today", icon: LayoutDashboard },
      { labelKey: "nav.inbox", path: "/life/inbox", icon: Inbox },
      { labelKey: "nav.tasks", path: "/life/tasks", icon: ListChecks },
      { labelKey: "nav.projects", path: "/life/projects", icon: LayoutList },
      { labelKey: "nav.processes", path: "/life/processes", icon: Repeat2 },
      { labelKey: "nav.calendar", path: "/life/calendar", icon: CalendarDays },
      { labelKey: "nav.habits", path: "/life/habits", icon: CheckCircle2 },
      { labelKey: "nav.goals", path: "/life/goals", icon: Target },
      { labelKey: "nav.progress", path: "/life/progress", icon: LineChart },
      { labelKey: "nav.settings", path: "/life/settings", icon: Settings },
    ],
  },
  {
    id: "expense",
    labelKey: "system.expense.name",
    descKey: "system.expense.desc",
    icon: Wallet,
    accent: "text-sky-600 dark:text-sky-400",
    ring: "border-sky-500/60 bg-sky-500/5",
    glow: "from-sky-500/15",
    root: "/expense",
    nav: [
      { labelKey: "nav.exp.dashboard", path: "/expense/dashboard", icon: LayoutDashboard },
      { labelKey: "nav.exp.transactions", path: "/expense/transactions", icon: Coins },
      { labelKey: "nav.exp.categories", path: "/expense/categories", icon: ClipboardList },
      { labelKey: "nav.exp.reports", path: "/expense/reports", icon: BarChart3 },
      { labelKey: "nav.exp.accounts", path: "/expense/accounts", icon: Wallet },
      { labelKey: "nav.exp.recurring", path: "/expense/recurring", icon: Repeat2 },
      { labelKey: "nav.exp.debts", path: "/expense/debts", icon: HandCoins },
      { labelKey: "nav.exp.savings", path: "/expense/savings", icon: PiggyBank },
      { labelKey: "nav.settings", path: "/expense/settings", icon: Settings },
    ],
  },
  {
    id: "salon",
    labelKey: "system.salon.name",
    descKey: "system.salon.desc",
    icon: Scissors,
    accent: "text-rose-600 dark:text-rose-400",
    ring: "border-rose-500/60 bg-rose-500/5",
    glow: "from-rose-500/15",
    root: "/salon",
    nav: [
      { labelKey: "nav.salon.dashboard", path: "/salon/dashboard", icon: LayoutDashboard },
      { labelKey: "nav.salon.pos", path: "/salon/pos", icon: ShoppingCart },
      { labelKey: "nav.salon.sales", path: "/salon/sales", icon: Receipt },
      { labelKey: "nav.salon.customers", path: "/salon/customers", icon: Users },
      { labelKey: "nav.salon.services", path: "/salon/services", icon: Sparkles },
      { labelKey: "nav.salon.products", path: "/salon/products", icon: Package },
      { labelKey: "nav.salon.staff", path: "/salon/staff", icon: UserCog },
      { labelKey: "nav.salon.reports", path: "/salon/reports", icon: TrendingUp },
      { labelKey: "nav.settings", path: "/salon/settings", icon: Settings },
    ],
  },
  {
    id: "admin",
    labelKey: "system.admin.name",
    descKey: "system.admin.desc",
    icon: ShieldCheck,
    accent: "text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/60 bg-amber-500/5",
    glow: "from-amber-500/15",
    root: "/admin",
    nav: [
      { labelKey: "admin.overview", path: "/admin/overview", icon: LayoutDashboard },
      { labelKey: "admin.users", path: "/admin/users", icon: Users },
      { labelKey: "admin.activity", path: "/admin/activity", icon: ClipboardList },
      { labelKey: "admin.data", path: "/admin/data", icon: Database },
      { labelKey: "nav.settings", path: "/admin/settings", icon: Settings },
    ],
  },
  {
  id: "business",
    labelKey: "system.business.name",
    descKey: "system.business.desc",
    icon: ShoppingCart,
    accent: "text-violet-600 dark:text-violet-400",
    ring: "border-violet-500/60 bg-violet-500/5",
    glow: "from-violet-500/15",
    root: "/business",
    nav: [
      { labelKey: "nav.biz.dashboard", path: "/business/dashboard", icon: LayoutDashboard },
      { labelKey: "nav.biz.pos", path: "/business/pos", icon: ShoppingCart },
      { labelKey: "nav.biz.sales", path: "/business/sales", icon: FileText },
      { labelKey: "nav.biz.products", path: "/business/products", icon: Package },
      { labelKey: "nav.biz.inventory", path: "/business/inventory", icon: Boxes },
      { labelKey: "nav.biz.customers", path: "/business/customers", icon: Users },
      { labelKey: "nav.biz.suppliers", path: "/business/suppliers", icon: Truck },
      { labelKey: "nav.biz.purchases", path: "/business/purchases", icon: Truck },
      { labelKey: "nav.biz.expenses", path: "/business/expenses", icon: Receipt },
      { labelKey: "nav.biz.staff", path: "/business/staff", icon: UserCog },
      { labelKey: "nav.biz.quotes", path: "/business/quotes", icon: FilePlus2 },
      { labelKey: "nav.biz.reports", path: "/business/reports", icon: TrendingUp },
      { labelKey: "nav.biz.settings", path: "/business/settings", icon: Settings },
    ],
  },
];

export function systemById(id: SystemId | null | undefined): SystemDef | null {
  return SYSTEMS.find((s) => s.id === id) ?? null;
}

/** true when `path` belongs to the given system. */
export function pathInSystem(path: string, system: SystemDef): boolean {
  return path === system.root || path.startsWith(system.root + "/");
}
