/**
 * Dynamic module (system) registry.
 *
 * The four built-in systems (life/expense/business/admin) always exist, but
 * the super admin can add MORE modules from the panel — each with its own
 * name (EN/KM), icon, color and optional link. Enabled modules appear in
 * the system selector and the header switcher; disabled built-ins hide.
 * Configuration lives in the `app_config` table (key "modules") so it is
 * global and dynamic — nothing is hardcoded per deployment.
 */
import { useSyncExternalStore } from "react";
import { getConfig, setConfig, type SystemPerms } from "./db";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Code2,
  Database,
  Globe,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Package,
  Plane,
  Receipt,
  Scissors,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

const CONFIG_KEY = "modules";

export type AppModule = {
  /** stable id; built-ins use their SystemId, customs have "m-" prefix */
  id: string;
  /** i18n key for built-ins; empty for customs (use name/nameKm) */
  labelKey?: string;
  descKey?: string;
  name?: string;
  nameKm?: string;
  desc?: string;
  descKm?: string;
  icon: string; // key in ICONS
  /** tailwind text color classes */
  accent: string;
  /** path for built-ins; customs link to a URL (hash-routed or external) */
  path?: string;
  /** built-in module id this overlays (nav/route wiring) */
  builtin?: "life" | "expense" | "business" | "salon" | "admin";
  enabled: boolean;
  /** permission slot used by RequireSystem (customs default to their own id) */
  permKey?: keyof SystemPerms & string;
  order: number;
  custom?: boolean;
};

/** Icon palette the super admin can pick from. */
export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  wallet: Wallet,
  cart: ShoppingCart,
  store: Store,
  scissors: Scissors,
  package: Package,
  boxes: Boxes,
  truck: Truck,
  receipt: Receipt,
  banknote: Banknote,
  users: Users,
  heart: HeartPulse,
  shield: ShieldCheck,
  clipboard: ClipboardList,
  graduate: GraduationCap,
  plane: Plane,
  globe: Globe,
  wrench: Wrench,
  code: Code2,
  sparkles: Sparkles,
  database: Database,
  settings: SettingsIcon,
};

export const ACCENTS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-violet-600 dark:text-violet-400",
  "text-amber-600 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-teal-600 dark:text-teal-400",
];

/** The default registry = the four built-in systems, all enabled. */
export function defaultModules(): AppModule[] {
  return [
    {
      id: "life",
      labelKey: "system.life.name",
      descKey: "system.life.desc",
      icon: "heart",
      accent: "text-emerald-600 dark:text-emerald-400",
      builtin: "life",
      permKey: "life",
      enabled: true,
      order: 0,
    },
    {
      id: "expense",
      labelKey: "system.expense.name",
      descKey: "system.expense.desc",
      icon: "wallet",
      accent: "text-sky-600 dark:text-sky-400",
      builtin: "expense",
      permKey: "expense",
      enabled: true,
      order: 1,
    },
    {
      id: "business",
      labelKey: "system.business.name",
      descKey: "system.business.desc",
      icon: "cart",
      accent: "text-violet-600 dark:text-violet-400",
      builtin: "business",
      permKey: "business",
      enabled: true,
      order: 2,
    },
    {
      id: "salon",
      labelKey: "system.salon.name",
      descKey: "system.salon.desc",
      icon: "scissors",
      accent: "text-rose-600 dark:text-rose-400",
      builtin: "salon",
      permKey: "salon",
      enabled: true,
      order: 3,
    },
    {
      id: "admin",
      labelKey: "system.admin.name",
      descKey: "system.admin.desc",
      icon: "shield",
      accent: "text-amber-600 dark:text-amber-400",
      builtin: "admin",
      permKey: "admin",
      enabled: true,
      order: 3,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Store: cached registry with subscription + async refresh            */
/* ------------------------------------------------------------------ */

let modules: AppModule[] = defaultModules();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function sortModules(list: AppModule[]): AppModule[] {
  return [...list].sort((a, b) => a.order - b.order);
}

/** Merge a saved list over the defaults so new built-ins always appear. */
function mergeSaved(saved: unknown): AppModule[] {
  const defaults = defaultModules();
  if (!Array.isArray(saved)) return defaults;
  const byId = new Map(defaults.map((m) => [m.id, m]));
  for (const raw of saved) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Partial<AppModule>;
    if (!m.id) continue;
    const existing = byId.get(m.id);
    if (existing) {
      byId.set(m.id, { ...existing, ...m, custom: false });
    } else if (m.custom) {
      byId.set(m.id, { ...(m as AppModule), custom: true });
    }
  }
  return sortModules([...byId.values()]);
}

/** Load the registry from the cloud (once per session). */
export async function loadModules(): Promise<AppModule[]> {
  if (loaded) return modules;
  loaded = true;
  try {
    const saved = await getConfig(CONFIG_KEY);
    modules = mergeSaved(saved);
  } catch {
    // offline / no DB — keep defaults
  }
  emit();
  return modules;
}

export function getModules(): AppModule[] {
  return modules;
}

export function subscribeModules(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive hook — returns the current module list. */
export function useModules(): AppModule[] {
  return useSyncExternalStore(subscribeModules, getModules, getModules);
}

/** Only modules shown in the selector (enabled + has somewhere to go). */
export function selectableModules(list: AppModule[]): AppModule[] {
  return list.filter((m) => m.enabled && (m.builtin || m.path));
}

/** Save the whole registry to the cloud and update local cache. */
export async function saveModules(list: AppModule[]): Promise<void> {
  modules = sortModules(list);
  emit();
  await setConfig(CONFIG_KEY, modules);
}

/** Get a module by id. */
export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.id === id);
}
