import { useSyncExternalStore } from "react";
import {
  addDaysKey,
  parseDateKey,
  recurrenceMatches,
  toLocalDateKey,
  todayKey,
} from "./date-utils";
import { getAppData, saveAppData } from "./db";
import { svgEmoji } from "./image";

export { recurrenceMatches, recurrenceWeekdays } from "./date-utils";
import type {
  Account,
  AppData,
  AppSettings,
  BusinessData,
  BusinessExpense,
  CalendarEvent,
  Customer,
  Debt,
  Goal,
  Habit,
  ID,
  InboxItem,
  Note,
  Order,
  OrderLine,
  PaymentMethod,
  Priority,
  Process,
  ProcessStep,
  Product,
  Project,
  Purchase,
  PurchaseItem,
  Quote,
  QuoteStatus,
  Recurrence,
  RecurringTx,
  SavingGoal,
  SalonCustomer,
  SalonData,
  SalonProduct,
  SalonSale,
  SalonSaleLine,
  SalonService,
  SalonStaff,
  StaffMember,
  Subtask,
  Supplier,
  SystemId,
  Task,
  TaskStatus,
  Transaction,
  TxType,
} from "./types";

export const DATA_VERSION = 1;
const STORAGE_KEY = "flowday-data-v1";

/* ------------------------------------------------------------------ */
/* Session primitives (shared with hooks/use-auth.ts)                  */
/* ------------------------------------------------------------------ */

export const SESSION_KEY = "flowday-session-v1";

export type AppSession = {
  token: string;
  userId: string;
  email: string;
  name: string;
};

export function readSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppSession;
    return parsed?.token && parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(s: AppSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable — stay signed in for this tab only
  }
}

/**
 * Signed-in session for the current device. Kept beside the store so the
 * sync layer and the auth provider share one source of truth.
 */
export const getSession = readSession;

/**
 * Storage is scoped per signed-in account: each user gets an isolated
 * "table" of data (`flowday-data-v1:u:<userId>`), so accounts on the same
 * device never see each other's tasks. Signed-out visitors share the
 * default key. `switchUser` swaps the active dataset.
 */
let ownerId: string | null = null;

function storageKey(): string {
  return ownerId ? `${STORAGE_KEY}:u:${ownerId}` : STORAGE_KEY;
}

/** Point the store at another account's dataset (or the signed-out one). */
export function switchUser(owner: string | null) {
  if (owner === ownerId) return;
  persist(); // save the outgoing user's data under their key
  ownerId = owner;
  data = load();
  persist();
  listeners.forEach((l) => l());
  if (owner) {
    // Render local data first; fetch the cloud document after the current
    // frame so startup is not blocked by network latency.
    setTimeout(() => void pullRemote(), 0);
  }
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).slice(0, 12);
}

function nowTs(): number {
  return Date.now();
}

/* ------------------------------------------------------------------ */
/* Seed demo data                                                      */
/* ------------------------------------------------------------------ */

function seedData(): AppData {
  const t = nowTs();
  const goalHealth: Goal = {
    id: "goal-health",
    title: "Become healthier",
    description: "Build lasting fitness and energy habits.",
    status: "active",
    color: "#10b981",
    createdAt: t - 30 * 864e5,
    updatedAt: t,
  };
  const goalEnglish: Goal = {
    id: "goal-english",
    title: "Learn English",
    description: "Reach confident conversational fluency.",
    status: "active",
    color: "#6366f1",
    createdAt: t - 60 * 864e5,
    updatedAt: t,
  };

  const projFitness: Project = {
    id: "proj-fitness",
    name: "Fitness",
    description: "Get moving every day and build strength.",
    goalId: "goal-health",
    status: "active",
    color: "#10b981",
    order: 0,
    createdAt: t - 30 * 864e5,
    updatedAt: t,
  };
  const projEnglish: Project = {
    id: "proj-english",
    name: "Learn English",
    description: "Daily vocabulary, speaking and listening.",
    goalId: "goal-english",
    dueDate: addDaysKey(todayKey(), 60),
    status: "active",
    color: "#6366f1",
    order: 1,
    createdAt: t - 60 * 864e5,
    updatedAt: t,
  };
  const projWebsite: Project = {
    id: "proj-website",
    name: "Personal Website",
    description: "Design and launch my portfolio site.",
    status: "planning",
    color: "#f59e0b",
    order: 2,
    createdAt: t - 10 * 864e5,
    updatedAt: t,
  };

  const morningProcess: Process = {
    id: "proc-morning",
    name: "Morning Workout",
    description: "Wake the body up before the day starts.",
    steps: [
      { id: uid(), title: "Stretch", durationMin: 5, order: 0 },
      { id: uid(), title: "Run 20 minutes", durationMin: 20, order: 1 },
      { id: uid(), title: "Drink water", durationMin: 2, order: 2 },
      { id: uid(), title: "Shower", durationMin: 10, order: 3 },
    ],
    recurrence: { type: "daily" },
    tagIds: ["tag-health"],
    createdAt: t - 20 * 864e5,
    updatedAt: t,
  };
  const englishProcess: Process = {
    id: "proc-english",
    name: "Daily English Practice",
    description: "A little every day beats a lot once a week.",
    steps: [
      { id: uid(), title: "Learn 10 words", durationMin: 15, order: 0 },
      { id: uid(), title: "Speak for 10 minutes", durationMin: 10, order: 1 },
      { id: uid(), title: "Review notes", durationMin: 5, order: 2 },
    ],
    recurrence: { type: "weekdays" },
    tagIds: ["tag-learning"],
    createdAt: t - 45 * 864e5,
    updatedAt: t,
  };

  const habitExercise: Habit = {
    id: "habit-exercise",
    name: "Exercise",
    icon: "dumbbell",
    color: "#10b981",
    schedule: { type: "daily" },
    completions: [todayKey(), addDaysKey(todayKey(), -1), addDaysKey(todayKey(), -2), addDaysKey(todayKey(), -4), addDaysKey(todayKey(), -5)],
    createdAt: t - 25 * 864e5,
    updatedAt: t,
  };
  const habitWater: Habit = {
    id: "habit-water",
    name: "Drink water",
    icon: "droplets",
    color: "#0ea5e9",
    schedule: { type: "daily" },
    completions: [todayKey(), addDaysKey(todayKey(), -1), addDaysKey(todayKey(), -3), addDaysKey(todayKey(), -4), addDaysKey(todayKey(), -6)],
    createdAt: t - 25 * 864e5,
    updatedAt: t,
  };
  const habitSleep: Habit = {
    id: "habit-sleep",
    name: "Sleep 8 hours",
    icon: "moon",
    color: "#8b5cf6",
    schedule: { type: "daily" },
    completions: [addDaysKey(todayKey(), -1), addDaysKey(todayKey(), -2), addDaysKey(todayKey(), -3)],
    createdAt: t - 15 * 864e5,
    updatedAt: t,
  };
  const habitRead: Habit = {
    id: "habit-read",
    name: "Read",
    icon: "book-open",
    color: "#f59e0b",
    schedule: { type: "daily" },
    completions: [addDaysKey(todayKey(), -1), addDaysKey(todayKey(), -2), addDaysKey(todayKey(), -3), addDaysKey(todayKey(), -6)],
    createdAt: t - 15 * 864e5,
    updatedAt: t,
  };

  function mkTask(partial: Partial<Task> & { title: string }): Task {
    return {
      id: uid(),
      title: partial.title,
      description: partial.description,
      notes: partial.notes,
      status: partial.status ?? "todo",
      priority: partial.priority ?? "medium",
      dueDate: partial.dueDate,
      dueTime: partial.dueTime,
      projectId: partial.projectId,
      processId: partial.processId,
      processRunId: partial.processRunId,
      goalId: partial.goalId,
      tagIds: partial.tagIds ?? [],
      subtasks: partial.subtasks ?? [],
      recurrence: partial.recurrence,
      reminder: partial.reminder,
      order: partial.order ?? 0,
      createdAt: partial.createdAt ?? t,
      updatedAt: t,
      completedAt: partial.completedAt,
    };
  }

  const today = todayKey();
  const tasks: Task[] = [
    mkTask({
      title: "Finish project outline",
      status: "in_progress",
      priority: "high",
      dueDate: today,
      dueTime: "14:00",
      projectId: "proj-website",
      order: 0,
    }),
    mkTask({
      title: "Run 20 minutes",
      status: "todo",
      priority: "medium",
      dueDate: today,
      projectId: "proj-fitness",
      processId: "proc-morning",
      order: 1,
    }),
    mkTask({
      title: "Learn 10 words",
      status: "todo",
      priority: "medium",
      dueDate: today,
      projectId: "proj-english",
      processId: "proc-english",
      order: 2,
    }),
    mkTask({
      title: "Read 20 pages",
      status: "todo",
      priority: "low",
      dueDate: today,
      order: 3,
    }),
    mkTask({
      title: "Book dentist appointment",
      status: "waiting",
      priority: "low",
      dueDate: addDaysKey(today, 2),
      order: 4,
    }),
    mkTask({
      title: "Buy running shoes",
      status: "todo",
      priority: "medium",
      dueDate: addDaysKey(today, -1),
      projectId: "proj-fitness",
      order: 5,
    }),
    mkTask({
      title: "Practice speaking",
      status: "todo",
      priority: "high",
      dueDate: addDaysKey(today, 1),
      projectId: "proj-english",
      order: 6,
      subtasks: [
        { id: uid(), title: "Shadow a podcast for 5 min", completed: false },
        { id: uid(), title: "Record 1 min self-intro", completed: false },
      ],
    }),
    mkTask({
      title: "Plan next week",
      status: "todo",
      priority: "medium",
      dueDate: addDaysKey(today, 3),
      order: 7,
    }),
    mkTask({
      title: "Morning stretch",
      status: "completed",
      priority: "low",
      dueDate: today,
      projectId: "proj-fitness",
      completedAt: t - 3 * 36e5,
      order: 8,
    }),
    mkTask({
      title: "Watch English video",
      status: "completed",
      priority: "low",
      dueDate: today,
      projectId: "proj-english",
      completedAt: t - 5 * 36e5,
      order: 9,
    }),
    mkTask({
      title: "Review last week's spending",
      status: "completed",
      priority: "low",
      dueDate: addDaysKey(today, -1),
      completedAt: t - 26 * 36e5,
      order: 10,
    }),
  ];

  const events: CalendarEvent[] = [
    {
      id: uid(),
      title: "English course deadline",
      date: addDaysKey(today, 5),
      kind: "deadline",
      linkedId: "proj-english",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      title: "Friend's birthday dinner",
      date: addDaysKey(today, 2),
      time: "19:00",
      kind: "event",
      createdAt: t,
      updatedAt: t,
    },
  ];

  /* --- Expense system demo data --- */
  const dayAgo = (n: number) => t - n * 864e5;
  const methods: PaymentMethod[] = ["cash", "card", "bank", "other"];

  const txSeeds: [number, TxType, number, string, PaymentMethod, string?][] = [
    [1, "income", 1200, "salary", "bank", "Monthly salary"],
    [5, "expense", 220, "rent", "bank", "Monthly rent"],
    [6, "expense", 32.5, "bills", "cash", "Electricity bill"],
    [6, "expense", 12, "bills", "cash", "Internet"],
    [9, "expense", 9, "bills", "cash", "Phone top-up"],
    [4, "expense", 45, "shopping", "card", "New shirt and shoes"],
    [8, "expense", 7.5, "health", "cash", "Pharmacy"],
    [14, "expense", 60, "education", "card", "Online course"],
    [12, "income", 180, "business", "bank", "Freelance design work"],
    [20, "income", 50, "gift", "cash", "Birthday gift"],
    [3, "expense", 18, "transportation", "cash", "Tuk-tuk rides"],
  ];
  const transactions: Transaction[] = txSeeds.map(
    ([daysAgo, type, amount, category, method, note], i) => ({
      id: `tx-seed-${i}`,
      type,
      amount,
      category,
      method,
      date: addDaysKey(today, -daysAgo),
      note,
      createdAt: dayAgo(daysAgo),
      updatedAt: dayAgo(daysAgo),
    }),
  );

  // Light daily spending so charts and today's stats have life
  for (let d = 0; d < 21; d++) {
    const date = addDaysKey(today, -d);
    const ts = dayAgo(d);
    transactions.push({
      id: `tx-daily-food-${d}`,
      type: "expense",
      amount: 5 + (d % 5),
      category: "food",
      method: methods[d % 2],
      date,
      note: d % 2 ? "Lunch" : "Groceries",
      createdAt: ts,
      updatedAt: ts,
    });
    if (d % 3 === 0) {
      transactions.push({
        id: `tx-daily-bus-${d}`,
        type: "expense",
        amount: 2.5,
        category: "transportation",
        method: "cash",
        date,
        note: "Bus fare",
        createdAt: ts + 36e5,
        updatedAt: ts + 36e5,
      });
    }
    if (d % 7 === 2) {
      transactions.push({
        id: `tx-daily-fun-${d}`,
        type: "expense",
        amount: 12 + (d % 3) * 4,
        category: "entertainment",
        method: "card",
        date,
        note: "Movie night",
        createdAt: ts + 72e5,
        updatedAt: ts + 72e5,
      });
    }
  }

  const budgets: Record<string, number> = {
    food: 200,
    transportation: 80,
    bills: 150,
    shopping: 120,
  };

  /* --- Business / POS demo data --- */
  const bizCreated = t - 30 * 864e5;
  const prod = (
    id: string,
    name: string,
    sku: string,
    barcode: string,
    category: string,
    price: number,
    cost: number,
    stock: number,
    lowStockThreshold: number,
  ): Product => ({
    id,
    name,
    sku,
    barcode,
    category,
    price,
    cost,
    stock,
    lowStockThreshold,
    active: true,
    createdAt: bizCreated,
    updatedAt: t,
  });
  const pBeer = prod("prod-beer", "Angkor Beer 640ml", "DRK-001", "8859133100011", "drinks", 2.5, 1.8, 36, 12);
  const pCoke = prod("prod-coke", "Coca-Cola 330ml", "DRK-002", "8859133100028", "drinks", 1.2, 0.85, 52, 24);
  const pWater = prod("prod-water", "Drinking Water 1L", "DRK-003", "8859133100035", "drinks", 0.7, 0.4, 6, 12);
  const pCoffee = prod("prod-coffee", "Instant Coffee 3-in-1", "DRK-004", "8859133100042", "drinks", 0.9, 0.6, 40, 15);
  const pNoodles = prod("prod-noodles", "Instant Noodles", "SNK-001", "8859133100059", "snacks", 0.8, 0.5, 10, 10);
  const pChips = prod("prod-chips", "Potato Chips 90g", "SNK-002", "8859133100066", "snacks", 1.75, 1.2, 18, 8);
  const pCookie = prod("prod-cookie", "Butter Cookies 200g", "SNK-003", "8859133100073", "snacks", 2.2, 1.5, 14, 6);
  const pRice = prod("prod-rice", "Rice 5kg", "GEN-001", "8859133100080", "general", 6.5, 5.2, 22, 5);
  const pOil = prod("prod-oil", "Cooking Oil 1L", "GEN-002", "8859133100097", "general", 3.2, 2.6, 15, 5);
  const products: Product[] = [
    pBeer, pCoke, pWater, pCoffee, pNoodles, pChips, pCookie, pRice, pOil,
  ];

  // Demo product photos: tiny inline SVG placeholders (no network needed)
  const PRODUCT_IMAGES: Record<string, [string, string]> = {
    "prod-beer": ["🍺", "#fef3c7"],
    "prod-coke": ["🥤", "#fee2e2"],
    "prod-water": ["💧", "#e0f2fe"],
    "prod-coffee": ["☕", "#ede9fe"],
    "prod-noodles": ["🍜", "#fce7f3"],
    "prod-chips": ["🍟", "#fef9c3"],
    "prod-cookie": ["🍪", "#fde68a"],
    "prod-rice": ["🍚", "#f1f5f9"],
    "prod-oil": ["🧴", "#dcfce7"],
  };
  for (const p of products) {
    const [emoji, bg] = PRODUCT_IMAGES[p.id] ?? ["📦", "#f1f5f9"];
    p.image = svgEmoji(emoji, bg);
  }

  const customers: Customer[] = [
    { id: "cust-sokha", name: "Sokha Kim", phone: "+855 12 345 678", note: "Regular — buys drinks weekly", image: svgEmoji("👩", "#fce7f3"), createdAt: bizCreated, updatedAt: t },
    { id: "cust-dara", name: "Dara Long", phone: "+855 92 887 221", note: "Prefers cash", image: svgEmoji("👨", "#e0e7ff"), createdAt: t - 25 * 864e5, updatedAt: t },
    { id: "cust-chenda", name: "Chenda Pich", phone: "+855 78 450 903", email: "chenda@example.com", image: svgEmoji("👩🏽", "#fef3c7"), createdAt: t - 15 * 864e5, updatedAt: t },
    { id: "cust-vireak", name: "Vireak Son", phone: "+855 11 234 567", note: "Buys rice in bulk", image: svgEmoji("🧑", "#dcfce7"), createdAt: t - 8 * 864e5, updatedAt: t },
  ];

  const suppliers: Supplier[] = [
    { id: "sup-heng", name: "Heng Beverage Distributor", phone: "+855 23 999 111", note: "Drinks — delivery Tue & Fri", createdAt: bizCreated, updatedAt: t },
    { id: "sup-lucky", name: "Lucky Wholesale", phone: "+855 23 888 222", note: "Snacks and dry goods", createdAt: t - 20 * 864e5, updatedAt: t },
  ];

  const line = (p: Product, qty: number, discount = 0): OrderLine => ({
    productId: p.id,
    name: p.name,
    qty,
    price: p.price,
    cost: p.cost,
    discount,
  });
  const mkOrder = (
    number: number,
    createdAt: number,
    lines: OrderLine[],
    method: PaymentMethod,
    customerId?: ID,
    amountPaid?: number,
  ): Order => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const discountTotal = lines.reduce(
      (s, l) => s + l.qty * l.price * (l.discount / 100),
      0,
    );
    const costTotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
    const total = subtotal - discountTotal;
    return {
      id: `ord-${number}`,
      number,
      lines,
      subtotal,
      discountTotal,
      taxTotal: 0,
      total,
      costTotal,
      status: "completed",
      customerId,
      method,
      amountPaid,
      change:
        amountPaid !== undefined ? Math.max(0, amountPaid - total) : undefined,
      createdAt,
      updatedAt: createdAt,
    };
  };

  const orders: Order[] = [
    mkOrder(1, dayAgo(10), [line(pCoke, 2), line(pChips, 1)], "cash"),
    mkOrder(2, dayAgo(9), [line(pWater, 2), line(pNoodles, 3)], "cash"),
    mkOrder(3, dayAgo(8), [line(pRice, 1), line(pOil, 1)], "bank", "cust-vireak"),
    mkOrder(4, dayAgo(7), [line(pBeer, 6)], "cash", "cust-dara", 20),
    mkOrder(5, dayAgo(6), [line(pCoffee, 3), line(pCookie, 2)], "card"),
    mkOrder(6, dayAgo(5), [line(pOil, 1), line(pNoodles, 2)], "cash"),
    mkOrder(7, dayAgo(4), [line(pCoke, 12, 5)], "bank", "cust-chenda"),
    mkOrder(8, dayAgo(3), [line(pChips, 2), line(pWater, 2), line(pCookie, 1)], "cash"),
    mkOrder(9, t - 26 * 36e5, [line(pBeer, 4), line(pChips, 1)], "cash", "cust-dara", 15),
    mkOrder(10, t - 3 * 36e5, [line(pCoffee, 1), line(pNoodles, 2), line(pWater, 1)], "card", "cust-sokha"),
  ];
  // One refunded order so refund analytics have an example
  orders[2].status = "refunded";
  orders[2].refundedAt = orders[2].createdAt + 36e5;
  orders.reverse(); // newest first, matching checkoutOrder
  const orderCounter = orders.length;

  const purchases: Purchase[] = [
    {
      id: "pur-1",
      supplierId: "sup-heng",
      items: [
        { productId: "prod-coke", qty: 48, cost: 0.85 },
        { productId: "prod-beer", qty: 24, cost: 1.8 },
      ],
      total: 48 * 0.85 + 24 * 1.8,
      note: "Weekly drinks restock",
      createdAt: dayAgo(6),
      updatedAt: dayAgo(6),
    },
    {
      id: "pur-2",
      supplierId: "sup-lucky",
      items: [
        { productId: "prod-noodles", qty: 30, cost: 0.45 },
        { productId: "prod-chips", qty: 20, cost: 1.1 },
      ],
      total: 30 * 0.45 + 20 * 1.1,
      note: "Snacks delivery",
      createdAt: dayAgo(2),
      updatedAt: dayAgo(2),
    },
  ];

  const bizExpenses: BusinessExpense[] = [
    { id: "bizexp-1", category: "rent", amount: 150, method: "cash", date: addDaysKey(today, -5), note: "Shop rent", createdAt: dayAgo(5), updatedAt: dayAgo(5) },
    { id: "bizexp-2", category: "electricity", amount: 22.5, method: "cash", date: addDaysKey(today, -6), note: "Electricity bill", createdAt: dayAgo(6), updatedAt: dayAgo(6) },
    { id: "bizexp-3", category: "transportation", amount: 8, method: "card", date: addDaysKey(today, -1), note: "Supply pickup", createdAt: dayAgo(1), updatedAt: dayAgo(1) },
  ];

  const staff: StaffMember[] = [
    { id: "staff-chan", name: "Channy Sok", role: "Shop keeper", phone: "+855 12 111 222", salary: 220, active: true, createdAt: bizCreated, updatedAt: t },
    { id: "staff-vuth", name: "Vuthy Nou", role: "Stock keeper", phone: "+855 12 333 444", salary: 200, active: true, createdAt: t - 20 * 864e5, updatedAt: t },
    { id: "staff-malis", name: "Malis Kep", role: "Cashier (part-time)", phone: "+855 12 555 666", salary: 120, active: false, createdAt: t - 40 * 864e5, updatedAt: t },
  ];

  const quotes: Quote[] = [
    {
      id: "quote-1",
      number: 1,
      customerName: "Sokha Kim",
      lines: [line(pCoffee, 10, 5), line(pWater, 12)],
      subtotal: 17.4,
      discountTotal: 0.45,
      total: 16.95,
      costTotal: 10.8,
      status: "accepted",
      convertedOrderId: "ord-10",
      note: "Office supply bundle",
      createdAt: t - 4 * 864e5,
      updatedAt: t - 3 * 864e5,
    },
    {
      id: "quote-2",
      number: 2,
      customerName: "Vireak Son",
      lines: [line(pRice, 2), line(pOil, 2)],
      subtotal: 19.4,
      discountTotal: 0,
      total: 19.4,
      costTotal: 15.6,
      status: "sent",
      note: "Monthly household restock",
      createdAt: t - 2 * 864e5,
      updatedAt: t - 2 * 864e5,
    },
    {
      id: "quote-3",
      number: 3,
      customerName: "Dara Long",
      lines: [line(pChips, 5), line(pCoke, 6)],
      subtotal: 15.95,
      discountTotal: 0,
      total: 15.95,
      costTotal: 11.1,
      status: "draft",
      createdAt: t - 36e5,
      updatedAt: t - 36e5,
    },
  ];

  // The seeded salary transaction already covers this month's rule occurrence
  const recurringSalaryActive = !transactions.some(
    (tx) => tx.type === "income" && tx.category === "salary" && tx.date >= today,
  );

  return {
    version: DATA_VERSION,
    seeded: true,
    settings: {
      theme: "system",
      name: "there",
      weekStartsMonday: true,
    },
    tasks,
    inboxItems: [
      { id: uid(), text: "Call John tomorrow", createdAt: t - 2 * 36e5 },
      { id: uid(), text: "Idea: blog post about habits", createdAt: t - 5 * 36e5 },
    ],
    projects: [projFitness, projEnglish, projWebsite],
    processes: [morningProcess, englishProcess],
    processRuns: [],
    habits: [habitExercise, habitWater, habitSleep, habitRead],
    goals: [goalHealth, goalEnglish],
    tags: [
      { id: "tag-health", name: "health", color: "#10b981", createdAt: t },
      { id: "tag-learning", name: "learning", color: "#6366f1", createdAt: t },
      { id: "tag-errand", name: "errand", color: "#f59e0b", createdAt: t },
    ],
    notes: [
      {
        id: uid(),
        title: "Weekly review questions",
        body: "What went well?\nWhat did I avoid?\nWhat's the ONE thing next week?",
        createdAt: t - 7 * 864e5,
        updatedAt: t - 7 * 864e5,
      },
    ],
    calendarEvents: events,
    activeSystem: null,
    budgets,
    transactions,
    accounts: [
      { id: "acct-cash", name: "Cash Wallet", kind: "cash", balance: 124.5, color: "#10b981", createdAt: t - 30 * 864e5, updatedAt: t },
      { id: "acct-aba", name: "ABA Bank", kind: "bank", balance: 860, color: "#0ea5e9", createdAt: t - 30 * 864e5, updatedAt: t },
      { id: "acct-wing", name: "Wing", kind: "mobile", balance: 32.25, color: "#f59e0b", createdAt: t - 12 * 864e5, updatedAt: t },
    ],
    recurring: [
      { id: "rec-rent", type: "expense", amount: 220, category: "rent", method: "bank", startDate: addDaysKey(today, -75), dayOfMonth: 5, note: "Monthly rent", active: true, createdAt: t - 75 * 864e5, updatedAt: t },
      { id: "rec-salary", type: "income", amount: 1200, category: "salary", method: "bank", startDate: addDaysKey(today, -75), dayOfMonth: 1, note: "Monthly salary", active: recurringSalaryActive, createdAt: t - 75 * 864e5, updatedAt: t },
    ],
    debts: [
      { id: "debt-lending", name: "Sokha (lent)", direction: "receivable", total: 60, paid: 20, dueDate: addDaysKey(today, 10), note: "Lent for fuel", createdAt: t - 9 * 864e5, updatedAt: t },
      { id: "debt-installment", name: "Laptop installment", direction: "payable", total: 480, paid: 180, dueDate: addDaysKey(today, 20), note: "12-month plan", createdAt: t - 60 * 864e5, updatedAt: t },
    ],
    savings: [
      {
        id: "sav-emergency",
        name: "Emergency fund",
        target: 500,
        saved: 320,
        color: "#10b981",
        emoji: "🛟",
        targetDate: addDaysKey(today, 90),
        note: "Three months of safety",
        contributions: [
          { id: uid(), amount: 150, date: addDaysKey(today, -30), note: "Initial deposit", createdAt: t - 30 * 864e5 },
          { id: uid(), amount: 120, date: addDaysKey(today, -12), note: "Payday bonus", createdAt: t - 12 * 864e5 },
          { id: uid(), amount: 50, date: addDaysKey(today, -3), note: "Weekly save", createdAt: t - 3 * 864e5 },
        ],
        createdAt: t - 30 * 864e5,
        updatedAt: t,
      },
      {
        id: "sav-phone",
        name: "New phone",
        target: 260,
        saved: 260,
        color: "#0ea5e9",
        emoji: "📱",
        reachedAt: t - 2 * 864e5,
        contributions: [
          { id: uid(), amount: 100, date: addDaysKey(today, -40), createdAt: t - 40 * 864e5 },
          { id: uid(), amount: 160, date: addDaysKey(today, -2), createdAt: t - 2 * 864e5 },
        ],
        createdAt: t - 40 * 864e5,
        updatedAt: t,
      },
    ],
    business: {
      products,
      customers,
      suppliers,
      orders,
      heldOrders: [],
      purchases,
      expenses: bizExpenses,
      orderCounter,
      quoteCounter: quotes.length,
      staff,
      quotes,
      taxRate: 0,
      taxEnabled: false,
      shopName: "Flowday Mart",
    },
    salon: {
      shopName: "Glow Salon",
      services: [
        { id: "sv-haircut", name: "Haircut", price: 8, duration: 30, color: "#ec4899", createdAt: t - 40 * 864e5, updatedAt: t },
        { id: "sv-color", name: "Hair coloring", price: 25, duration: 90, color: "#8b5cf6", createdAt: t - 40 * 864e5, updatedAt: t },
        { id: "sv-wash", name: "Wash & style", price: 5, duration: 20, color: "#0ea5e9", createdAt: t - 40 * 864e5, updatedAt: t },
        { id: "sv-facial", name: "Facial", price: 15, duration: 60, color: "#10b981", createdAt: t - 40 * 864e5, updatedAt: t },
      ],
      products: [
        { id: "sp-shampoo", name: "Shampoo 250ml", price: 6, cost: 3.5, stock: 12, lowStockThreshold: 4, sku: "SH-250", createdAt: t - 40 * 864e5, updatedAt: t },
        { id: "sp-serum", name: "Hair serum", price: 9, cost: 5, stock: 3, lowStockThreshold: 5, sku: "SR-001", createdAt: t - 40 * 864e5, updatedAt: t },
        { id: "sp-cream", name: "Face cream", price: 11, cost: 6.5, stock: 8, lowStockThreshold: 3, sku: "FC-100", createdAt: t - 40 * 864e5, updatedAt: t },
      ],
      customers: [
        { id: "sc-sokha", name: "Sokha", phone: "011 234 567", visits: 6, spent: 74, lastVisit: addDaysKey(today, -6), createdAt: t - 90 * 864e5, updatedAt: t },
        { id: "sc-dara", name: "Dara", phone: "012 345 678", visits: 3, spent: 51, lastVisit: addDaysKey(today, -15), createdAt: t - 60 * 864e5, updatedAt: t },
        { id: "sc-malis", name: "Malis", phone: "096 111 222", visits: 9, spent: 168, lastVisit: addDaysKey(today, -2), createdAt: t - 120 * 864e5, updatedAt: t },
      ],
      staff: [
        { id: "ss-davy", name: "Davy", role: "Senior stylist", phone: "011 000 111", commission: 40, createdAt: t - 90 * 864e5, updatedAt: t },
        { id: "ss-ratha", name: "Ratha", role: "Colorist", phone: "012 222 333", commission: 35, createdAt: t - 80 * 864e5, updatedAt: t },
        { id: "ss-kanha", name: "Kanha", role: "Nail artist", commission: 30, createdAt: t - 70 * 864e5, updatedAt: t },
      ],
      sales: [
        {
          id: "ss-1", number: 1, customerId: "sc-malis",
          lines: [
            { itemId: "sv-color", kind: "service", name: "Hair coloring", price: 25, qty: 1, discount: 0, staffId: "ss-ratha" },
            { itemId: "sp-shampoo", kind: "product", name: "Shampoo 250ml", price: 6, qty: 1, discount: 0 },
          ],
          subtotal: 31, discountTotal: 0, total: 31, method: "cash", date: today, createdAt: t - 5 * 36e5,
        },
        {
          id: "ss-2", number: 2, customerId: "sc-sokha",
          lines: [{ itemId: "sv-haircut", kind: "service", name: "Haircut", price: 8, qty: 1, discount: 0, staffId: "ss-davy" }],
          subtotal: 8, discountTotal: 0, total: 8, method: "cash", date: addDaysKey(today, -1), createdAt: t - 30 * 36e5,
        },
        {
          id: "ss-3", number: 3, customerId: "sc-dara",
          lines: [{ itemId: "sv-facial", kind: "service", name: "Facial", price: 15, qty: 1, discount: 20, staffId: "ss-davy" }],
          subtotal: 15, discountTotal: 3, total: 12, method: "card", date: addDaysKey(today, -3), createdAt: t - 80 * 36e5,
        },
      ],
      saleCounter: 3,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

let data: AppData = load();
const listeners = new Set<() => void>();

/**
 * Fill in fields added after a user's document was first saved (localStorage
 * or Neon). Keeps version 1 docs forward-compatible instead of discarding
 * real user data when new systems ship.
 */
export function normalizeData(parsed: Partial<AppData> | null | undefined): AppData {
  // Base is an EMPTY document, not the demo seed: a stored doc always wins,
  // and any field it lacks becomes empty — demo content must never leak
  // into a real user's account (each user's data is their own input only).
  const fresh = emptyData();
  if (!parsed || typeof parsed !== "object") return fresh;
  return {
    ...fresh,
    ...parsed,
    version: DATA_VERSION,
    settings: { ...fresh.settings, ...(parsed.settings ?? {}) },
    budgets:
      parsed.budgets && typeof parsed.budgets === "object"
        ? Object.fromEntries(
            Object.entries(parsed.budgets).filter(
              (entry): entry is [string, number] => typeof entry[1] === "number",
            ),
          )
        : {},
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
    debts: Array.isArray(parsed.debts) ? parsed.debts : [],
    savings: Array.isArray(parsed.savings) ? parsed.savings : [],
    business: {
      ...fresh.business,
      ...(parsed.business ?? {}),
      products: Array.isArray(parsed.business?.products)
        ? parsed.business!.products
        : [],
      customers: Array.isArray(parsed.business?.customers)
        ? parsed.business!.customers
        : [],
      suppliers: Array.isArray(parsed.business?.suppliers)
        ? parsed.business!.suppliers
        : [],
      orders: Array.isArray(parsed.business?.orders) ? parsed.business!.orders : [],
      heldOrders: Array.isArray(parsed.business?.heldOrders)
        ? parsed.business!.heldOrders
        : [],
      purchases: Array.isArray(parsed.business?.purchases)
        ? parsed.business!.purchases
        : [],
      expenses: Array.isArray(parsed.business?.expenses)
        ? parsed.business!.expenses
        : [],
      staff: Array.isArray(parsed.business?.staff) ? parsed.business!.staff : [],
      quotes: Array.isArray(parsed.business?.quotes) ? parsed.business!.quotes : [],
      quoteCounter:
        typeof parsed.business?.quoteCounter === "number"
          ? parsed.business.quoteCounter
          : 0,
    },
    salon: {
      ...fresh.salon,
      ...(parsed.salon ?? {}),
      services: Array.isArray(parsed.salon?.services) ? parsed.salon.services : [],
      products: Array.isArray(parsed.salon?.products) ? parsed.salon.products : [],
      customers: Array.isArray(parsed.salon?.customers) ? parsed.salon.customers : [],
      staff: Array.isArray(parsed.salon?.staff) ? parsed.salon.staff : [],
      sales: Array.isArray(parsed.salon?.sales) ? parsed.salon.sales : [],
      saleCounter:
        typeof parsed.salon?.saleCounter === "number" ? parsed.salon.saleCounter : 0,
    },
  };
}

/**
 * A brand-new account's document: completely empty, nothing pre-filled.
 * Each user's data is their own input only — demo content is never added
 * to a real account.
 */
function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    seeded: false,
    settings: {
      theme: "system",
      name: "there",
      weekStartsMonday: true,
    },
    tasks: [],
    inboxItems: [],
    projects: [],
    processes: [],
    processRuns: [],
    habits: [],
    goals: [],
    tags: [],
    notes: [],
    calendarEvents: [],
    activeSystem: null,
    budgets: {},
    transactions: [],
    accounts: [],
    recurring: [],
    debts: [],
    savings: [],
    business: {
      products: [],
      customers: [],
      suppliers: [],
      orders: [],
      heldOrders: [],
      purchases: [],
      expenses: [],
      orderCounter: 0,
      quoteCounter: 0,
      staff: [],
      quotes: [],
      taxRate: 0,
      taxEnabled: false,
      shopName: "",
    },
    salon: {
      shopName: "",
      services: [],
      products: [],
      customers: [],
      staff: [],
      sales: [],
      saleCounter: 0,
    },
  };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      if (parsed && typeof parsed === "object") {
        // normalizeData fills any missing fields and stamps the current
        // version — an older stored document is upgraded, never discarded.
        return normalizeData(parsed);
      }
    }
  } catch {
    // corrupted storage — fall through to a fresh document
  }
  // Fresh context: signed-out visitors get the demo dataset (landing
  // experience); a signed-in account with no stored document starts EMPTY —
  // their data is whatever they input themselves. If the account already
  // has a remote document, pullRemote() restores it right after.
  const fresh = ownerId ? emptyData() : seedData();
  try {
    localStorage.setItem(storageKey(), JSON.stringify(fresh));
  } catch {
    // storage may be unavailable (private mode); keep in-memory
  }
  return fresh;
}

function persist() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function set(updater: (d: AppData) => AppData) {
  data = updater(data);
  persist();
  dirtySinceSync = true;
  listeners.forEach((l) => l());
  queuePush(); // debounced background sync to Postgres
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getData(): AppData {
  return data;
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}

/* ------------------------------------------------------------------ */
/* Remote sync (Neon Postgres)                                         */
/*                                                                     */
/* Local-first: every mutation writes to localStorage immediately and   */
/* then queues a debounced push of the whole document to the signed-in  */
/* user's row in the `app_data` table. Signing in pulls the remote      */
/* document first, so the same account sees the same data everywhere.   */
/* ------------------------------------------------------------------ */

export type SyncState = { syncing: boolean; error: string | null };

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let lastSyncError: string | null = null;
// True when the local document changed since the last pull/push. Prevents an
// async pull from clobbering edits the user made while it was in flight.
let dirtySinceSync = false;
const syncListeners = new Set<() => void>();

// Cached snapshot for useSyncExternalStore — it must return the SAME object
// reference between state changes, otherwise React re-renders forever
// (production throws "Maximum update depth exceeded", error #185).
let syncSnapshot: SyncState = { syncing: false, error: null };

function notifySync() {
  syncSnapshot = { syncing, error: lastSyncError };
  syncListeners.forEach((l) => l());
}

export function subscribeSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function getSyncState(): SyncState {
  return syncSnapshot;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}

/**
 * Tick hook: re-renders subscribers once per minute so "today"-derived UI
 * (Today page, greetings, overdue counts) rolls over at midnight even when
 * the PWA has been open all night.
 */
const tickListeners = new Set<() => void>();
let tickSnapshot = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function ensureTickTimer() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    const now = Date.now();
    if (now - tickSnapshot >= 55_000) {
      tickSnapshot = now;
      tickListeners.forEach((l) => l());
    }
  }, 60_000);
}

function subscribeTick(listener: () => void): () => void {
  ensureTickTimer();
  tickListeners.add(listener);
  return () => tickListeners.delete(listener);
}

function getTickSnapshot(): number {
  return tickSnapshot;
}

/** Subscribe to the one-per-minute clock tick (safe anywhere in React). */
export function useMinuteTick(): number {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickSnapshot);
}

/** Pull the signed-in user's document from Postgres into local state. */
export async function pullRemote(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  syncing = true;
  lastSyncError = null;
  notifySync();
  try {
    const remote = (await getAppData(session.userId)) as AppData | null;
    if (dirtySinceSync) {
      // Local edits happened while pulling — local wins, push instead.
      queuePush();
      return true;
    }
    if (remote && typeof remote === "object" && Array.isArray(remote.tasks)) {
      data = normalizeData(remote as Partial<AppData>);
      persist();
      dirtySinceSync = false;
      listeners.forEach((l) => l());
    }
    return true;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    return false;
  } finally {
    syncing = false;
    notifySync();
  }
}/** Push the current document to Postgres (debounced). */
export function queuePush() {
  if (!getSession()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushNow();
  }, 1200);
}

export async function pushNow(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  if (syncing) {
    // Another push/pull is in flight — re-queue instead of silently
    // dropping this one, or offline edits made during a sync would be lost
    // until the next unrelated change.
    queuePush();
    return false;
  }
  syncing = true;
  lastSyncError = null;
  notifySync();
  try {
    await saveAppData(session.userId, data);
    // An edit made WHILE this push was in flight re-flips dirtySinceSync
    // (set() runs during the await) — capture and re-push so it isn't lost.
    const becameDirtyAgain = dirtySinceSync;
    dirtySinceSync = false;
    if (becameDirtyAgain) void pushNow();
    return true;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    return false;
  } finally {
    syncing = false;
    notifySync();
  }
}

/** Re-sync when connectivity returns so offline edits reach Neon ASAP. */
export function initOnlineSync() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => {
    const session = getSession();
    if (!session) return;
    if (dirtySinceSync) {
      void pushNow();
    } else {
      void pullRemote();
    }
  };
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}

/* ------------------------------------------------------------------ */
/* Settings / theme                                                    */
/* ------------------------------------------------------------------ */

export function useSettings(): AppSettings {
  return useAppData().settings;
}

export function updateSettings(patch: Partial<AppSettings>) {
  set((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export function useTasks(): Task[] {
  return useAppData().tasks;
}

export type NewTaskInput = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">> & {
  title: string;
};

export function addTask(input: NewTaskInput, tasksOverride?: Task[]): Task {
  const list = tasksOverride ?? data.tasks;
  const order = list.length
    ? Math.min(...list.map((t) => t.order)) - 1
    : 0;
  const ts = nowTs();
  const task: Task = {
    id: uid(),
    title: input.title,
    description: input.description,
    status: input.status ?? (input.dueDate ? "todo" : "inbox"),
    priority: input.priority ?? "medium",
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    projectId: input.projectId,
    processId: input.processId,
    processRunId: input.processRunId,
    goalId: input.goalId,
    tagIds: input.tagIds ?? [],
    subtasks: input.subtasks ?? [],
    recurrence: input.recurrence,
    reminder: input.reminder,
    order: input.order ?? order,
    createdAt: ts,
    updatedAt: ts,
    completedAt: input.status === "completed" ? ts : undefined,
  };
  if (tasksOverride) return task; // caller manages list
  set((d) => ({ ...d, tasks: [task, ...d.tasks] }));
  return task;
}

export function updateTask(id: string, patch: Partial<Task>) {
  set((d) => ({
    ...d,
    tasks: d.tasks.map((t) => {
      if (t.id !== id) return t;
      const next: Task = { ...t, ...patch, updatedAt: nowTs() };
      // Keep completedAt consistent with the new status so completed-task
      // metrics (Progress page) never count reopened tasks, and every
      // completed task carries a completion timestamp.
      if (patch.status !== undefined) {
        next.completedAt =
          patch.status === "completed" ? (t.completedAt ?? nowTs()) : undefined;
      }
      return next;
    }),
  }));
}

export function toggleTask(id: string) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  const completed = task.status === "completed";
  set((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            status: completed ? "todo" : "completed",
            completedAt: completed ? undefined : nowTs(),
            subtasks: completed
              ? t.subtasks
              : t.subtasks.map((s) => ({ ...s, completed: true })),
            updatedAt: nowTs(),
          }
        : t,
    ),
  }));
  // When completing a recurring task, spawn the next occurrence
  if (!completed && task.recurrence) {
    spawnNextRecurrence(task);
  }
}

function spawnNextRecurrence(task: Task) {
  if (!task.dueDate || !task.recurrence) return;
  let next = addDaysKey(task.dueDate, 1);
  let guard = 0;
  while (!recurrenceMatches(task.recurrence, next) && guard < 400) {
    next = addDaysKey(next, 1);
    guard++;
  }
  if (guard >= 400) return;
  const copy: Task = {
    ...task,
    id: uid(),
    status: "todo",
    completedAt: undefined,
    dueDate: next,
    order: task.order - 1,
    createdAt: nowTs(),
    updatedAt: nowTs(),
    subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
  };
  set((d) => ({ ...d, tasks: [copy, ...d.tasks] }));
}

export function deleteTask(id: string) {
  set((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
}

export function reorderTasks(activeId: string, overId: string) {
  const tasks = [...data.tasks];
  const a = tasks.find((t) => t.id === activeId);
  const b = tasks.find((t) => t.id === overId);
  if (!a || !b) return;
  const others = tasks.filter((t) => t.id !== activeId);
  const overIndex = others.findIndex((t) => t.id === overId);
  if (overIndex < 0) return;
  const newList = [...others];
  newList.splice(overIndex, 0, a);
  // Renormalize order values
  const sorted = newList.map((t, i) => ({ ...t, order: i }));
  set((d) => ({ ...d, tasks: sorted }));
}

export function toggleSubtask(taskId: string, subtaskId: string) {
  set((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s,
            ),
            updatedAt: nowTs(),
          }
        : t,
    ),
  }));
}

export function addSubtask(taskId: string, title: string) {
  set((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            subtasks: [...t.subtasks, { id: uid(), title, completed: false }],
            updatedAt: nowTs(),
          }
        : t,
    ),
  }));
}

export function removeSubtask(taskId: string, subtaskId: string) {
  set((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
            updatedAt: nowTs(),
          }
        : t,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export function useInboxItems(): InboxItem[] {
  return useAppData().inboxItems;
}

export function addInboxItem(text: string) {
  const item: InboxItem = { id: uid(), text: text.trim(), createdAt: nowTs() };
  set((d) => ({ ...d, inboxItems: [item, ...d.inboxItems] }));
}

export function deleteInboxItem(id: string) {
  set((d) => ({ ...d, inboxItems: d.inboxItems.filter((i) => i.id !== id) }));
}

export function organizeInboxItem(
  itemId: string,
  target: "task" | "project" | "goal" | "habit" | "process",
) {
  const item = data.inboxItems.find((i) => i.id === itemId);
  if (!item) return;
  let newId: string | undefined;
  switch (target) {
    case "task":
      newId = addTask({ title: item.text, status: "todo" }).id;
      break;
    case "project":
      newId = addProject({ name: item.text }).id;
      break;
    case "goal":
      newId = addGoal({ title: item.text }).id;
      break;
    case "habit":
      newId = addHabit({ name: item.text, schedule: { type: "daily" } }).id;
      break;
    case "process":
      newId = addProcess({
        name: item.text,
        steps: [{ id: uid(), title: item.text, order: 0 }],
      }).id;
      break;
  }
  set((d) => ({
    ...d,
    inboxItems: d.inboxItems.map((i) =>
      i.id === itemId
        ? { ...i, organizedId: newId, organizedType: target }
        : i,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function useProjects(): Project[] {
  return useAppData().projects;
}

export function addProject(input: Partial<Project> & { name: string }): Project {
  const project: Project = {
    id: uid(),
    name: input.name,
    description: input.description,
    goalId: input.goalId,
    dueDate: input.dueDate,
    status: input.status ?? "active",
    color: input.color,
    order: input.order ?? data.projects.length,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  set((d) => ({ ...d, projects: [...d.projects, project] }));
  return project;
}

export function updateProject(id: string, patch: Partial<Project>) {
  set((d) => ({
    ...d,
    projects: d.projects.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: nowTs() } : p,
    ),
  }));
}

export function deleteProject(id: string) {
  set((d) => ({
    ...d,
    projects: d.projects.filter((p) => p.id !== id),
    tasks: d.tasks.map((t) =>
      t.projectId === id ? { ...t, projectId: undefined, updatedAt: nowTs() } : t,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Processes                                                           */
/* ------------------------------------------------------------------ */

export function useProcesses(): Process[] {
  return useAppData().processes;
}

export function addProcess(
  input: Partial<Process> & { name: string },
): Process {
  const process: Process = {
    id: uid(),
    name: input.name,
    description: input.description,
    steps: input.steps ?? [],
    recurrence: input.recurrence,
    startDate: input.startDate,
    endDate: input.endDate,
    tagIds: input.tagIds ?? [],
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  set((d) => ({ ...d, processes: [...d.processes, process] }));
  return process;
}

export function updateProcess(id: string, patch: Partial<Process>) {
  set((d) => ({
    ...d,
    processes: d.processes.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: nowTs() } : p,
    ),
  }));
}

export function deleteProcess(id: string) {
  set((d) => ({
    ...d,
    processes: d.processes.filter((p) => p.id !== id),
    tasks: d.tasks.filter((t) => !(t.processId === id && t.status !== "completed")),
  }));
}

export function addProcessStep(processId: string, title: string) {
  set((d) => ({
    ...d,
    processes: d.processes.map((p) =>
      p.id === processId
        ? {
            ...p,
            steps: [
              ...p.steps,
              { id: uid(), title, order: p.steps.length },
            ],
            updatedAt: nowTs(),
          }
        : p,
    ),
  }));
}

export function updateProcessStep(
  processId: string,
  stepId: string,
  patch: Partial<ProcessStep>,
) {
  set((d) => ({
    ...d,
    processes: d.processes.map((p) =>
      p.id === processId
        ? {
            ...p,
            steps: p.steps.map((s) =>
              s.id === stepId ? { ...s, ...patch } : s,
            ),
            updatedAt: nowTs(),
          }
        : p,
    ),
  }));
}

export function deleteProcessStep(processId: string, stepId: string) {
  set((d) => ({
    ...d,
    processes: d.processes.map((p) =>
      p.id === processId
        ? {
            ...p,
            steps: p.steps
              .filter((s) => s.id !== stepId)
              .map((s, i) => ({ ...s, order: i })),
            updatedAt: nowTs(),
          }
        : p,
    ),
  }));
}

export function moveProcessStep(processId: string, stepId: string, dir: -1 | 1) {
  set((d) => ({
    ...d,
    processes: d.processes.map((p) => {
      if (p.id !== processId) return p;
      const steps = [...p.steps];
      const idx = steps.findIndex((s) => s.id === stepId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= steps.length) return p;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...p, steps: steps.map((s, i) => ({ ...s, order: i })) };
    }),
  }));
}

/** Create tasks for a process scheduled on dateKey (one run per date). */
export function scheduleProcess(processId: string, dateKey: string): boolean {
  const proc = data.processes.find((p) => p.id === processId);
  if (!proc) return false;
  const already = data.tasks.some(
    (t) => t.processId === processId && t.dueDate === dateKey,
  );
  if (already) return false;
  const runId = uid();
  const newTasks: Task[] = proc.steps.map((step, i) => ({
    id: uid(),
    title: step.title,
    status: "todo",
    priority: "medium",
    dueDate: dateKey,
    processId,
    processRunId: runId,
    tagIds: [...proc.tagIds],
    subtasks: [],
    order: i,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  }));
  set((d) => ({
    ...d,
    tasks: [...newTasks, ...d.tasks],
    processRuns: [
      ...d.processRuns,
      {
        id: runId,
        processId,
        date: dateKey,
        startedAt: nowTs(),
      },
    ],
  }));
  return true;
}

export function unscheduleProcess(processId: string, dateKey: string) {
  set((d) => ({
    ...d,
    tasks: d.tasks.filter(
      (t) => !(t.processId === processId && t.dueDate === dateKey && t.status !== "completed"),
    ),
    processRuns: d.processRuns.filter(
      (r) => !(r.processId === processId && r.date === dateKey),
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

export function useHabits(): Habit[] {
  return useAppData().habits.filter((h) => !h.archived);
}

export function addHabit(
  input: Partial<Habit> & { name: string; schedule: Recurrence },
): Habit {
  const habit: Habit = {
    id: uid(),
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    schedule: input.schedule,
    timeOfDay: input.timeOfDay ?? "anytime",
    completions: [],
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  set((d) => ({ ...d, habits: [...d.habits, habit] }));
  return habit;
}

export function updateHabit(id: string, patch: Partial<Habit>) {
  set((d) => ({
    ...d,
    habits: d.habits.map((h) =>
      h.id === id ? { ...h, ...patch, updatedAt: nowTs() } : h,
    ),
  }));
}

export function deleteHabit(id: string) {
  set((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }));
}

export function toggleHabitDate(habitId: string, dateKey: string) {
  set((d) => ({
    ...d,
    habits: d.habits.map((h) => {
      if (h.id !== habitId) return h;
      const has = h.completions.includes(dateKey);
      return {
        ...h,
        completions: has
          ? h.completions.filter((c) => c !== dateKey)
          : [...h.completions, dateKey],
        updatedAt: nowTs(),
      };
    }),
  }));
}

/**
 * Consecutive scheduled days (ending today or yesterday) the habit was
 * completed. Days the habit is not scheduled (e.g. weekends for a weekdays
 * schedule) are skipped without breaking the streak, and completions logged
 * on unscheduled days don't count.
 */
export function habitStreak(habit: Habit): number {
  let streak = 0;
  let cursor = todayKey();
  // Allow today to be incomplete without breaking yesterday's streak
  if (!habit.completions.includes(cursor)) {
    cursor = addDaysKey(cursor, -1);
  }
  for (let guard = 0; guard < 800; guard++) {
    if (recurrenceMatches(habit.schedule, cursor)) {
      if (!habit.completions.includes(cursor)) break;
      streak++;
    }
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function habitBestStreak(habit: Habit): number {
  const days = [...habit.completions].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    if (prev && addDaysKey(prev, 1) === day) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

export function useGoals(): Goal[] {
  return useAppData().goals;
}

export function addGoal(input: Partial<Goal> & { title: string }): Goal {
  const goal: Goal = {
    id: uid(),
    title: input.title,
    description: input.description,
    targetDate: input.targetDate,
    status: input.status ?? "active",
    color: input.color,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  set((d) => ({ ...d, goals: [...d.goals, goal] }));
  return goal;
}

export function updateGoal(id: string, patch: Partial<Goal>) {
  set((d) => ({
    ...d,
    goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: nowTs() } : g)),
  }));
}

export function deleteGoal(id: string) {
  set((d) => ({
    ...d,
    goals: d.goals.filter((g) => g.id !== id),
    projects: d.projects.map((p) =>
      p.goalId === id ? { ...p, goalId: undefined, updatedAt: nowTs() } : p,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

export function useTags() {
  return useAppData().tags;
}

export function addTag(name: string, color?: string): string {
  const tag = { id: uid(), name: name.toLowerCase(), color, createdAt: nowTs() };
  set((d) => ({ ...d, tags: [...d.tags, tag] }));
  return tag.id;
}

export function ensureTagIds(names: string[]): string[] {
  return names.map((n) => {
    const existing = data.tags.find(
      (t) => t.name.toLowerCase() === n.toLowerCase(),
    );
    return existing ? existing.id : addTag(n);
  });
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export function useNotes(): Note[] {
  return useAppData().notes;
}

export function addNote(title: string, body?: string): Note {
  const note: Note = { id: uid(), title, body, createdAt: nowTs(), updatedAt: nowTs() };
  set((d) => ({ ...d, notes: [note, ...d.notes] }));
  return note;
}

export function updateNote(id: string, patch: Partial<Note>) {
  set((d) => ({
    ...d,
    notes: d.notes.map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: nowTs() } : n,
    ),
  }));
}

export function deleteNote(id: string) {
  set((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
}

/* ------------------------------------------------------------------ */
/* Calendar events                                                     */
/* ------------------------------------------------------------------ */

export function useCalendarEvents(): CalendarEvent[] {
  return useAppData().calendarEvents;
}

export function addEvent(
  input: Partial<CalendarEvent> & { title: string; date: string },
): CalendarEvent {
  const event: CalendarEvent = {
    id: uid(),
    title: input.title,
    date: input.date,
    time: input.time,
    kind: input.kind ?? "event",
    linkedId: input.linkedId,
    notes: input.notes,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  set((d) => ({ ...d, calendarEvents: [...d.calendarEvents, event] }));
  return event;
}

export function updateEvent(id: string, patch: Partial<CalendarEvent>) {
  set((d) => ({
    ...d,
    calendarEvents: d.calendarEvents.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: nowTs() } : e,
    ),
  }));
}

export function deleteEvent(id: string) {
  set((d) => ({
    ...d,
    calendarEvents: d.calendarEvents.filter((e) => e.id !== id),
  }));
}

/* ------------------------------------------------------------------ */
/* Data management                                                     */
/* ------------------------------------------------------------------ */

export function resetDemoData() {
  const fresh = seedData();
  set(() => fresh);
}

export function clearAllData() {
  const empty: AppData = {
    ...seedData(),
    version: DATA_VERSION,
    seeded: false,
    settings: data.settings,
    transactions: [],
    accounts: [],
    recurring: [],
    debts: [],
    savings: [],
    business: { ...data.business, products: [], customers: [], suppliers: [], orders: [], heldOrders: [], purchases: [], expenses: [], staff: [], quotes: [], orderCounter: 0, quoteCounter: 0 },
    salon: {
      ...data.salon,
      services: [],
      products: [],
      customers: [],
      staff: [],
      sales: [],
      saleCounter: 0,
    },
    tasks: [],
    inboxItems: [],
    projects: [],
    processes: [],
    processRuns: [],
    habits: [],
    goals: [],
    tags: [],
    notes: [],
    calendarEvents: [],
  };
  set(() => empty);
}

export function exportData(): string {
  return JSON.stringify(data, null, 2);
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Partial<AppData>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
      return false;
    }
    set(() => normalizeData(parsed));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function tasksForDate(tasks: Task[], dateKey: string): Task[] {
  return tasks.filter(
    (t) => t.dueDate === dateKey && t.status !== "inbox",
  );
}

export function overdueTasks(tasks: Task[]): Task[] {
  const today = todayKey();
  return tasks.filter(
    (t) => t.status !== "completed" && t.status !== "inbox" && t.dueDate && t.dueDate < today,
  );
}

export function projectProgress(tasks: Task[], projectId: string): number {
  const pt = tasks.filter((t) => t.projectId === projectId);
  if (pt.length === 0) return 0;
  const done = pt.filter((t) => t.status === "completed").length;
  return Math.round((done / pt.length) * 100);
}

export function goalProgress(
  tasks: Task[],
  projects: Project[],
  goalId: string,
): number {
  const goalProjects = projects.filter((p) => p.goalId === goalId);
  const goalTasks = tasks.filter(
    (t) =>
      t.goalId === goalId ||
      (t.projectId && goalProjects.some((p) => p.id === t.projectId)),
  );
  if (goalTasks.length === 0) {
    const gp = goalProjects.map((p) => projectProgress(tasks, p.id));
    if (gp.length === 0) return 0;
    return Math.round(gp.reduce((a, b) => a + b, 0) / gp.length);
  }
  const done = goalTasks.filter((t) => t.status === "completed").length;
  return Math.round((done / goalTasks.length) * 100);
}

export function nextOccurrencePreview(rec: Recurrence | undefined): string {
  if (!rec) return "";
  let cursor = addDaysKey(todayKey(), 1);
  for (let i = 0; i < 400; i++) {
    if (recurrenceMatches(rec, cursor)) return cursor;
    cursor = addDaysKey(cursor, 1);
  }
  return "";
}

export type { Task, TaskStatus, Priority, Subtask };

/* ================================================================== */
/* Systems: one app, three workspaces                                  */
/* ================================================================== */

export function useActiveSystem(): SystemId | null {
  return useAppData().activeSystem;
}

/** Remember the last system used; the selector pre-selects it. */
export function setActiveSystem(system: SystemId | null) {
  set((d) => ({ ...d, activeSystem: system }));
}

/* ================================================================== */
/* Date-range filtering (shared by expense + business)                 */
/* ================================================================== */

export type DateFilterKind =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "lastMonth"
  | "year"
  | "all"
  | "custom";

export type DateFilter = {
  kind: DateFilterKind;
  from?: string; // yyyy-MM-dd (custom)
  to?: string;
};

export const DATE_FILTER_KINDS: DateFilterKind[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "lastMonth",
  "year",
  "all",
  "custom",
];

function startOfWeekKey(d: Date): string {
  const dow = d.getDay();
  return toLocalDateKey(addDaysLocal(d, -((dow + 6) % 7))); // Monday
}

function addDaysLocal(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Resolve a filter to an inclusive [from, to] yyyy-MM-dd range. */
export function resolveDateRange(f: DateFilter): { from: string; to: string } {
  const today = todayKey();
  const now = parseDateKey(today);
  switch (f.kind) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDaysKey(today, -1);
      return { from: y, to: y };
    }
    case "week":
      return { from: startOfWeekKey(now), to: today };
    case "month":
      return { from: toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toLocalDateKey(first), to: toLocalDateKey(last) };
    }
    case "year":
      return { from: toLocalDateKey(new Date(now.getFullYear(), 0, 1)), to: today };
    case "custom":
      return { from: f.from ?? "0000-01-01", to: f.to ?? "9999-12-31" };
    case "all":
    default:
      return { from: "0000-01-01", to: "9999-12-31" };
  }
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

/* ================================================================== */
/* Expense system: transactions                                        */
/* ================================================================== */

export function useTransactions(): Transaction[] {
  return useAppData().transactions;
}

/* ------------------------------------------------------------------ */
/* Accounts (expense wallets)                                          */
/* ------------------------------------------------------------------ */

export function useAccounts(): Account[] {
  return useAppData().accounts;
}

export function addAccount(input: Omit<Account, "id" | "createdAt" | "updatedAt" | "archived">): Account {
  const ts = nowTs();
  const account: Account = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, accounts: [account, ...d.accounts] }));
  return account;
}

export function updateAccount(id: string, patch: Partial<Account>) {
  set((d) => ({
    ...d,
    accounts: d.accounts.map((a) =>
      a.id === id ? { ...a, ...patch, updatedAt: nowTs() } : a,
    ),
  }));
}

export function deleteAccount(id: string) {
  set((d) => ({ ...d, accounts: d.accounts.filter((a) => a.id !== id) }));
}

export function addTransaction(
  input: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): Transaction {
  const ts = nowTs();
  const tx: Transaction = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, transactions: [tx, ...d.transactions] }));
  return tx;
}

export function updateTransaction(id: string, patch: Partial<Transaction>) {
  set((d) => ({
    ...d,
    transactions: d.transactions.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: nowTs() } : t,
    ),
  }));
}

export function deleteTransaction(id: string) {
  set((d) => ({
    ...d,
    transactions: d.transactions.filter((t) => t.id !== id),
  }));
}

/* ------------------------------------------------------------------ */
/* Recurring transactions (monthly bills / salary)                     */
/* ------------------------------------------------------------------ */

export function useRecurring(): RecurringTx[] {
  return useAppData().recurring;
}

export function addRecurring(
  input: Omit<RecurringTx, "id" | "createdAt" | "updatedAt" | "lastRun">,
): RecurringTx {
  const ts = nowTs();
  const rule: RecurringTx = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, recurring: [rule, ...d.recurring] }));
  return rule;
}

export function updateRecurring(id: string, patch: Partial<RecurringTx>) {
  set((d) => ({
    ...d,
    recurring: d.recurring.map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: nowTs() } : r,
    ),
  }));
}

export function deleteRecurring(id: string) {
  set((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== id) }));
}

/** Occurrence date for a rule in a given month (clamped to the month end). */
function monthlyOccurrence(ym: string, dayOfMonth: number): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${ym}-${String(day).padStart(2, "0")}`;
}

/**
 * Post every due occurrence of every active rule as a real transaction.
 * Idempotent: `lastRun` marks the latest posted date, so calling twice
 * in the same month never double-posts. Returns the number posted.
 */
export function postDueRecurring(): number {
  const today = todayKey();
  const ym = today.slice(0, 7);
  let posted = 0;
  set((d) => {
    const newTx = [...d.transactions];
    let changed = false;
    const recurring = d.recurring.map((rule) => {
      if (!rule.active) return rule;
      const occ = monthlyOccurrence(ym, rule.dayOfMonth);
      if (occ > today) return rule; // not due yet this month
      const from = rule.lastRun
        ? addDaysKey(rule.lastRun, 1)
        : rule.startDate <= occ
          ? occ
          : rule.startDate;
      if (from > occ) return rule;
      const tx: Transaction = {
        id: uid(),
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        method: rule.method,
        date: occ,
        note: rule.note,
        createdAt: nowTs(),
        updatedAt: nowTs(),
      };
      newTx.unshift(tx);
      posted++;
      changed = true;
      return { ...rule, lastRun: occ, updatedAt: nowTs() };
    });
    if (!changed) return d;
    return { ...d, recurring, transactions: newTx };
  });
  return posted;
}

/* ------------------------------------------------------------------ */
/* Debts (payables / receivables)                                      */
/* ------------------------------------------------------------------ */

export function useDebts(): Debt[] {
  return useAppData().debts;
}

export function addDebt(input: Omit<Debt, "id" | "createdAt" | "updatedAt" | "paid" | "settledAt">): Debt {
  const ts = nowTs();
  const debt: Debt = { ...input, paid: 0, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, debts: [debt, ...d.debts] }));
  return debt;
}

export function updateDebt(id: string, patch: Partial<Debt>) {
  set((d) => ({
    ...d,
    debts: d.debts.map((x) =>
      x.id === id ? { ...x, ...patch, updatedAt: nowTs() } : x,
    ),
  }));
}

/** Record a payment against a debt; auto-settles when fully paid. */
export function payDebt(id: string, amount: number): number {
  const debt = data.debts.find((x) => x.id === id);
  if (!debt) return 0;
  const paid = Math.min(debt.total, Math.max(0, debt.paid + amount));
  const ts = nowTs();
  set((d) => ({
    ...d,
    debts: d.debts.map((x) =>
      x.id === id
        ? {
            ...x,
            paid,
            settledAt: paid >= x.total ? ts : x.settledAt,
            updatedAt: ts,
          }
        : x,
    ),
  }));
  return paid - debt.paid;
}

/* ------------------------------------------------------------------ */
/* Savings (goal pots inside the expense system)                       */
/* ------------------------------------------------------------------ */

export function useSavings(): SavingGoal[] {
  return useAppData().savings;
}

export function addSavingGoal(
  input: Omit<
    SavingGoal,
    "id" | "createdAt" | "updatedAt" | "saved" | "reachedAt" | "contributions" | "archived"
  > & { saved?: number },
): SavingGoal {
  const ts = nowTs();
  const goal: SavingGoal = {
    ...input,
    saved: Math.max(0, input.saved ?? 0),
    contributions: [],
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
  };
  if (goal.saved >= goal.target && goal.target > 0) goal.reachedAt = ts;
  set((d) => ({ ...d, savings: [goal, ...d.savings] }));
  return goal;
}

export function updateSavingGoal(id: string, patch: Partial<SavingGoal>) {
  set((d) => ({
    ...d,
    savings: d.savings.map((g) =>
      g.id === id ? { ...g, ...patch, updatedAt: nowTs() } : g,
    ),
  }));
}

export function deleteSavingGoal(id: string) {
  set((d) => ({ ...d, savings: d.savings.filter((g) => g.id !== id) }));
}

/**
 * Contribute to (amount > 0) or withdraw from (amount < 0) a goal.
 * Returns the delta actually applied — withdrawals clamp at the saved
 * balance, and a goal that crosses its target gets stamped reachedAt.
 */
export function contributeSaving(id: string, amount: number): number {
  const goal = data.savings.find((g) => g.id === id);
  if (!goal || !Number.isFinite(amount) || amount === 0) return 0;
  const applied =
    amount > 0
      ? amount
      : Math.max(-goal.saved, amount); // never withdraw below zero
  const saved = goal.saved + applied;
  const ts = nowTs();
  set((d) => ({
    ...d,
    savings: d.savings.map((g) =>
      g.id === id
        ? {
            ...g,
            saved,
            reachedAt:
              g.target > 0 && saved >= g.target ? (g.reachedAt ?? ts) : undefined,
            contributions: [
              {
                id: uid(),
                amount: applied,
                date: todayKey(),
                createdAt: ts,
              },
              ...g.contributions,
            ],
            updatedAt: ts,
          }
        : g,
    ),
  }));
  return applied;
}

export function useStaff(): StaffMember[] {
  return useAppData().business.staff;
}

export function addStaff(input: Omit<StaffMember, "id" | "createdAt" | "updatedAt">): StaffMember {
  const ts = nowTs();
  const member: StaffMember = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  patchBusiness({ staff: [member, ...data.business.staff] });
  return member;
}

export function updateStaff(id: string, patch: Partial<StaffMember>) {
  patchBusiness({
    staff: data.business.staff.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: nowTs() } : s,
    ),
  });
}

export function deleteStaff(id: string) {
  patchBusiness({ staff: data.business.staff.filter((s) => s.id !== id) });
}

export function useQuotes(): Quote[] {
  return useAppData().business.quotes;
}

/** Compute quote totals exactly like cartTotals (no tax on quotes). */
function quoteTotals(lines: OrderLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discountTotal = lines.reduce(
    (s, l) => s + l.qty * l.price * (l.discount / 100),
    0,
  );
  const costTotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  return { subtotal, discountTotal, total: subtotal - discountTotal, costTotal };
}

export function addQuote(input: {
  customerName: string;
  lines: OrderLine[];
  note?: string;
}): Quote {
  const ts = nowTs();
  const biz = data.business;
  const number = biz.quoteCounter + 1;
  const totals = quoteTotals(input.lines);
  const quote: Quote = {
    id: uid(),
    number,
    customerName: input.customerName,
    lines: input.lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    total: totals.total,
    costTotal: totals.costTotal,
    status: "draft",
    note: input.note,
    createdAt: ts,
    updatedAt: ts,
  };
  patchBusiness({ quotes: [quote, ...biz.quotes], quoteCounter: number });
  return quote;
}

export function updateQuoteStatus(id: string, status: QuoteStatus) {
  patchBusiness({
    quotes: data.business.quotes.map((q) =>
      q.id === id ? { ...q, status, updatedAt: nowTs() } : q,
    ),
  });
}

export function deleteQuote(id: string) {
  patchBusiness({ quotes: data.business.quotes.filter((q) => q.id !== id) });
}

/**
 * Accept a quote: create a completed order from its lines, decrement
 * stock, and link the order back to the quote. Returns the new order.
 */
export function acceptQuote(id: string): Order | null {
  const quote = data.business.quotes.find((q) => q.id === id);
  if (!quote || quote.status === "accepted") return null;
  const ts = nowTs();
  const biz = data.business;
  const number = biz.orderCounter + 1;
  const totals = quoteTotals(quote.lines);
  const order: Order = {
    id: uid(),
    number,
    lines: quote.lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: 0,
    total: totals.total,
    costTotal: totals.costTotal,
    status: "completed",
    method: "other",
    createdAt: ts,
    updatedAt: ts,
  };
  const products = biz.products.map((p) => {
    const line = quote.lines.find((l) => l.productId === p.id);
    if (!line) return p;
    return { ...p, stock: Math.max(0, p.stock - line.qty), updatedAt: ts };
  });
  patchBusiness({
    orders: [order, ...biz.orders],
    products,
    orderCounter: number,
    quotes: biz.quotes.map((q) =>
      q.id === id
        ? { ...q, status: "accepted" as const, convertedOrderId: order.id, updatedAt: ts }
        : q,
    ),
  });
  return order;
}
/** Staff & quotes live after the debt helpers. */
export function deleteDebt(id: string) {
  set((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== id) }));
}

/** Filter + sort transactions by date range, type and category. */
export function filterTransactions(
  transactions: Transaction[],
  filter: DateFilter,
  opts?: { type?: TxType | "all"; category?: string | "all"; method?: PaymentMethod | "all"; search?: string },
): Transaction[] {
  const { from, to } = resolveDateRange(filter);
  const q = opts?.search?.trim().toLowerCase();
  return transactions
    .filter((t) => inRange(t.date, from, to))
    .filter((t) => !opts?.type || opts.type === "all" || t.type === opts.type)
    .filter((t) => !opts?.category || opts.category === "all" || t.category === opts.category)
    .filter((t) => !opts?.method || opts.method === "all" || t.method === opts.method)
    .filter((t) => !q || t.note?.toLowerCase().includes(q) || t.category.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export type ExpenseTotals = {
  income: number;
  expense: number;
  balance: number;
  count: number;
};

export function sumTransactions(transactions: Transaction[]): ExpenseTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense, count: transactions.length };
}

/** Group transaction amounts by category, largest first. */
export function byCategory(
  transactions: Transaction[],
  type: TxType,
): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Daily net totals across a date range (for charts). */
export function dailyTotals(
  transactions: Transaction[],
  from: string,
  to: string,
): { date: string; income: number; expense: number }[] {
  const map = new Map<string, { income: number; expense: number }>();
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    map.set(cursor, { income: 0, expense: 0 });
    cursor = addDaysKey(cursor, 1);
    guard++;
  }
  for (const t of transactions) {
    const bucket = map.get(t.date);
    if (!bucket) continue;
    if (t.type === "income") bucket.income += t.amount;
    else bucket.expense += t.amount;
  }
  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

/* ================================================================== */
/* Business: products / customers / suppliers / purchases / expenses   */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Salon Management system (walk-in POS model)                         */
/* ------------------------------------------------------------------ */

export function useSalon(): SalonData {
  return useAppData().salon;
}

export function updateSalonSettings(patch: Partial<Pick<SalonData, "shopName">>) {
  set((d) => ({ ...d, salon: { ...d.salon, ...patch } }));
}

/* ----- services ----- */

export function addSalonService(input: Omit<SalonService, "id" | "createdAt" | "updatedAt">): SalonService {
  const ts = nowTs();
  const svc: SalonService = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, salon: { ...d.salon, services: [svc, ...d.salon.services] } }));
  return svc;
}

export function updateSalonService(id: string, patch: Partial<SalonService>) {
  const ts = nowTs();
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      services: d.salon.services.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: ts } : x)),
    },
  }));
}

export function deleteSalonService(id: string) {
  set((d) => ({ ...d, salon: { ...d.salon, services: d.salon.services.filter((x) => x.id !== id) } }));
}

/* ----- products (retail stock) ----- */

export function useSalonProducts(): SalonProduct[] {
  return useAppData().salon.products;
}

export function addSalonProduct(input: Omit<SalonProduct, "id" | "createdAt" | "updatedAt">): SalonProduct {
  const ts = nowTs();
  const prod: SalonProduct = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, salon: { ...d.salon, products: [prod, ...d.salon.products] } }));
  return prod;
}

export function updateSalonProduct(id: string, patch: Partial<SalonProduct>) {
  const ts = nowTs();
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      products: d.salon.products.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: ts } : x)),
    },
  }));
}

export function deleteSalonProduct(id: string) {
  set((d) => ({ ...d, salon: { ...d.salon, products: d.salon.products.filter((x) => x.id !== id) } }));
}

/** Stock movement: positive restocks, negative removes (clamped at 0). */
export function adjustSalonStock(id: string, delta: number): number {
  const prod = data.salon.products.find((x) => x.id === id);
  if (!prod) return 0;
  const next = Math.max(0, prod.stock + delta);
  const ts = nowTs();
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      products: d.salon.products.map((x) => (x.id === id ? { ...x, stock: next, updatedAt: ts } : x)),
    },
  }));
  return next;
}

/* ----- customers ----- */

export function addSalonCustomer(input: Omit<SalonCustomer, "id" | "visits" | "spent" | "createdAt" | "updatedAt">): SalonCustomer {
  const ts = nowTs();
  const c: SalonCustomer = { ...input, id: uid(), visits: 0, spent: 0, createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, salon: { ...d.salon, customers: [c, ...d.salon.customers] } }));
  return c;
}

export function updateSalonCustomer(id: string, patch: Partial<SalonCustomer>) {
  const ts = nowTs();
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      customers: d.salon.customers.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: ts } : x)),
    },
  }));
}

export function deleteSalonCustomer(id: string) {
  set((d) => ({ ...d, salon: { ...d.salon, customers: d.salon.customers.filter((x) => x.id !== id) } }));
}

/* ----- staff ----- */

export function addSalonStaff(input: Omit<SalonStaff, "id" | "createdAt" | "updatedAt">): SalonStaff {
  const ts = nowTs();
  const m: SalonStaff = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  set((d) => ({ ...d, salon: { ...d.salon, staff: [m, ...d.salon.staff] } }));
  return m;
}

export function updateSalonStaff(id: string, patch: Partial<SalonStaff>) {
  const ts = nowTs();
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      staff: d.salon.staff.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: ts } : x)),
    },
  }));
}

export function deleteSalonStaff(id: string) {
  set((d) => ({ ...d, salon: { ...d.salon, staff: d.salon.staff.filter((x) => x.id !== id) } }));
}

/* ----- walk-in sales (POS checkout) ----- */

/**
 * Complete a walk-in sale: records the receipt, decrements product stock,
 * and rolls customer stats forward (visits +1, spent +total, lastVisit).
 * Product lines must have stock available — the caller checks, this clamps.
 */
export function checkoutSalonSale(input: {
  lines: SalonSaleLine[];
  customerId?: string;
  method: PaymentMethod;
  date?: string;
}): SalonSale {
  const ts = nowTs();
  const date = input.date ?? todayKey();

  const lines = input.lines.map((l) => ({
    ...l,
    qty: Math.max(1, Math.round(l.qty)),
    discount: Math.min(100, Math.max(0, l.discount)),
  }));
  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  const discountTotal =
    Math.round(lines.reduce((s, l) => s + (l.price * l.qty * l.discount) / 100, 0) * 100) / 100;
  const total = Math.round((subtotal - discountTotal) * 100) / 100;

  const sale: SalonSale = {
    id: uid(),
    number: data.salon.saleCounter + 1,
    customerId: input.customerId,
    lines,
    subtotal,
    discountTotal,
    total,
    method: input.method,
    date,
    createdAt: ts,
  };

  const productDeltas = new Map<string, number>();
  for (const l of lines) {
    if (l.kind === "product") productDeltas.set(l.itemId, (productDeltas.get(l.itemId) ?? 0) + l.qty);
  }

  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      sales: [sale, ...d.salon.sales],
      saleCounter: sale.number,
      products: d.salon.products.map((p) => {
        const used = productDeltas.get(p.id);
        return used ? { ...p, stock: Math.max(0, p.stock - used), updatedAt: ts } : p;
      }),
      customers: input.customerId
        ? d.salon.customers.map((c) =>
            c.id === input.customerId
              ? {
                  ...c,
                  visits: c.visits + 1,
                  spent: Math.round((c.spent + sale.total) * 100) / 100,
                  lastVisit: date,
                  updatedAt: ts,
                }
              : c,
          )
        : d.salon.customers,
    },
  }));
  return sale;
}

export function deleteSalonSale(id: string) {
  const sale = data.salon.sales.find((x) => x.id === id);
  if (!sale) return;
  const ts = nowTs();
  const productDeltas = new Map<string, number>();
  for (const l of sale.lines) {
    if (l.kind === "product") productDeltas.set(l.itemId, (productDeltas.get(l.itemId) ?? 0) + l.qty);
  }
  set((d) => ({
    ...d,
    salon: {
      ...d.salon,
      sales: d.salon.sales.filter((x) => x.id !== id),
      products: d.salon.products.map((p) => {
        const back = productDeltas.get(p.id);
        return back ? { ...p, stock: p.stock + back, updatedAt: ts } : p;
      }),
      customers: sale.customerId
        ? d.salon.customers.map((c) =>
            c.id === sale.customerId
              ? {
                  ...c,
                  visits: Math.max(0, c.visits - 1),
                  spent: Math.max(0, Math.round((c.spent - sale.total) * 100) / 100),
                  updatedAt: ts,
                }
              : c,
          )
        : d.salon.customers,
    },
  }));
}

export function useBusiness(): BusinessData {
  return useAppData().business;
}

export function useProducts(): Product[] {
  return useAppData().business.products;
}

export function useCustomers(): Customer[] {
  return useAppData().business.customers;
}

export function useSuppliers(): Supplier[] {
  return useAppData().business.suppliers;
}

function patchBusiness(patch: Partial<BusinessData>) {
  set((d) => ({ ...d, business: { ...d.business, ...patch } }));
}

export function addProduct(input: Omit<Product, "id" | "createdAt" | "updatedAt" | "active"> & { active?: boolean }): Product {
  const ts = nowTs();
  const product: Product = { active: true, ...input, id: uid(), createdAt: ts, updatedAt: ts };
  patchBusiness({ products: [product, ...data.business.products] });
  return product;
}

export function updateProduct(id: string, patch: Partial<Product>) {
  patchBusiness({
    products: data.business.products.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: nowTs() } : p,
    ),
  });
}

export function deleteProduct(id: string) {
  patchBusiness({ products: data.business.products.filter((p) => p.id !== id) });
}

export function addCustomer(input: Omit<Customer, "id" | "createdAt" | "updatedAt">): Customer {
  const ts = nowTs();
  const customer: Customer = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  patchBusiness({ customers: [customer, ...data.business.customers] });
  return customer;
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  patchBusiness({
    customers: data.business.customers.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: nowTs() } : c,
    ),
  });
}

export function deleteCustomer(id: string) {
  patchBusiness({ customers: data.business.customers.filter((c) => c.id !== id) });
}

export function addSupplier(input: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Supplier {
  const ts = nowTs();
  const supplier: Supplier = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  patchBusiness({ suppliers: [supplier, ...data.business.suppliers] });
  return supplier;
}

export function deleteSupplier(id: string) {
  patchBusiness({ suppliers: data.business.suppliers.filter((s) => s.id !== id) });
}

/** Record a purchase: raises stock and (weighted-average) product cost. */
export function addPurchase(input: {
  supplierId?: ID;
  items: PurchaseItem[];
  note?: string;
}): Purchase {
  const total = input.items.reduce((sum, it) => sum + it.qty * it.cost, 0);
  const purchase: Purchase = {
    ...input,
    total,
    id: uid(),
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  const products = data.business.products.map((p) => {
    const item = input.items.find((i) => i.productId === p.id);
    if (!item || item.qty <= 0) return p;
    // Weighted-average cost so COGS stays accurate across price changes.
    const cost = item.qty + p.stock > 0
      ? (p.cost * p.stock + item.cost * item.qty) / (p.stock + item.qty)
      : item.cost;
    return {
      ...p,
      stock: p.stock + item.qty,
      cost: Math.round(cost * 100) / 100,
      updatedAt: nowTs(),
    };
  });
  patchBusiness({ purchases: [purchase, ...data.business.purchases], products });
  return purchase;
}

export function deletePurchase(id: string) {
  patchBusiness({ purchases: data.business.purchases.filter((p) => p.id !== id) });
}

export function addBusinessExpense(
  input: Omit<BusinessExpense, "id" | "createdAt" | "updatedAt">,
): BusinessExpense {
  const ts = nowTs();
  const exp: BusinessExpense = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  patchBusiness({ expenses: [exp, ...data.business.expenses] });
  return exp;
}

export function updateBusinessExpense(id: string, patch: Partial<BusinessExpense>) {
  patchBusiness({
    expenses: data.business.expenses.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: nowTs() } : e,
    ),
  });
}

export function deleteBusinessExpense(id: string) {
  patchBusiness({ expenses: data.business.expenses.filter((e) => e.id !== id) });
}

export function updateBusinessSettings(patch: Partial<Pick<BusinessData, "taxRate" | "taxEnabled" | "shopName">>) {
  patchBusiness(patch);
}

/**
 * Manual stock correction (shrinkage, damage, recount). Unlike restock,
 * this does NOT create a purchase record — it only moves the number.
 */
export function adjustStock(productId: ID, delta: number) {
  const ts = nowTs();
  patchBusiness({
    products: data.business.products.map((p) =>
      p.id === productId
        ? { ...p, stock: Math.max(0, p.stock + delta), updatedAt: ts }
        : p,
    ),
  });
}

/** Set (or clear with 0) the monthly budget for an expense category. */
export function setBudget(category: string, amount: number) {
  set((d) => {
    const next = { ...d.budgets };
    if (amount > 0) next[category] = amount;
    else delete next[category];
    return { ...d, budgets: next };
  });
}

/* ================================================================== */
/* POS: cart, checkout, refunds, held orders                           */
/* ================================================================== */

export type CartLine = OrderLine;

export function lineTotal(line: OrderLine): number {
  return line.qty * line.price * (1 - line.discount / 100);
}

export function cartTotals(
  lines: OrderLine[],
  opts: { taxRate: number; taxEnabled: boolean },
) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discountTotal = lines.reduce(
    (s, l) => s + l.qty * l.price * (l.discount / 100),
    0,
  );
  const costTotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const net = subtotal - discountTotal;
  const taxTotal = opts.taxEnabled ? net * (opts.taxRate / 100) : 0;
  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: net + taxTotal,
    costTotal,
  };
}

/**
 * Confirm a POS sale: create the order, decrement stock, bump the receipt
 * counter. One atomic store update so a crash mid-checkout can't half-apply.
 */
export function checkoutOrder(input: {
  lines: OrderLine[];
  customerId?: ID;
  method: PaymentMethod;
  amountPaid?: number;
}): Order {
  const biz = data.business;
  const totals = cartTotals(input.lines, {
    taxRate: biz.taxRate,
    taxEnabled: biz.taxEnabled,
  });
  const ts = nowTs();
  const number = biz.orderCounter + 1;
  const order: Order = {
    id: uid(),
    number,
    lines: input.lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    costTotal: totals.costTotal,
    status: "completed",
    customerId: input.customerId,
    method: input.method,
    amountPaid: input.amountPaid,
    change:
      input.amountPaid !== undefined
        ? Math.max(0, input.amountPaid - totals.total)
        : undefined,
    createdAt: ts,
    updatedAt: ts,
  };
  const products = biz.products.map((p) => {
    const line = input.lines.find((l) => l.productId === p.id);
    if (!line) return p;
    return { ...p, stock: Math.max(0, p.stock - line.qty), updatedAt: ts };
  });
  set((d) => ({
    ...d,
    business: {
      ...d.business,
      orders: [order, ...d.business.orders],
      products,
      orderCounter: number,
    },
  }));
  return order;
}

/** Refund an order: mark refunded and restock the lines. */
export function refundOrder(id: string) {
  const order = data.business.orders.find((o) => o.id === id);
  if (!order || order.status === "refunded") return;
  const ts = nowTs();
  const products = data.business.products.map((p) => {
    const line = order.lines.find((l) => l.productId === p.id);
    if (!line) return p;
    return { ...p, stock: p.stock + line.qty, updatedAt: ts };
  });
  set((d) => ({
    ...d,
    business: {
      ...d.business,
      orders: d.business.orders.map((o) =>
        o.id === id
          ? { ...o, status: "refunded" as const, refundedAt: ts, updatedAt: ts }
          : o,
      ),
      products,
    },
  }));
}

export function holdOrder(lines: OrderLine[], customerId?: ID) {
  patchBusiness({
    heldOrders: [
      { id: uid(), lines, customerId, createdAt: nowTs() },
      ...data.business.heldOrders,
    ],
  });
}

/** Resume a held order — removes it from the hold list and returns its lines. */
export function resumeHeldOrder(id: string): { lines: OrderLine[]; customerId?: ID } | null {
  const held = data.business.heldOrders.find((h) => h.id === id);
  if (!held) return null;
  patchBusiness({
    heldOrders: data.business.heldOrders.filter((h) => h.id !== id),
  });
  return { lines: held.lines, customerId: held.customerId };
}

export function discardHeldOrder(id: string) {
  patchBusiness({ heldOrders: data.business.heldOrders.filter((h) => h.id !== id) });
}

/* ================================================================== */
/* Business analytics (computed from real orders/expenses/purchases)   */
/* ================================================================== */

export function filterOrders(orders: Order[], filter: DateFilter): Order[] {
  const { from, to } = resolveDateRange(filter);
  const fromTs = parseDateKey(from).getTime();
  const toTs = parseDateKey(to).getTime() + 864e5 - 1; // inclusive end-of-day
  return orders
    .filter((o) => o.createdAt >= fromTs && o.createdAt <= toTs)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function filterBusinessExpenses(
  expenses: BusinessExpense[],
  filter: DateFilter,
): BusinessExpense[] {
  const { from, to } = resolveDateRange(filter);
  return expenses
    .filter((e) => inRange(e.date, from, to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export type BusinessStats = {
  revenue: number; // completed sales (post-discount, pre-tax... incl. tax)
  refunds: number;
  cogs: number; // cost of goods sold for completed orders
  expenses: number; // business expenses
  grossProfit: number; // revenue - refunds - cogs
  netProfit: number; // grossProfit - expenses
  orderCount: number;
  avgOrder: number;
  purchases: number;
  byMethod: Record<PaymentMethod, number>;
  byCategory: { category: string; total: number }[]; // business expenses
  topProducts: { name: string; qty: number; revenue: number }[];
};

export function businessStats(
  orders: Order[],
  expenses: BusinessExpense[],
  purchases: Purchase[],
  filter: DateFilter,
): BusinessStats {
  const filteredOrders = filterOrders(orders, filter);
  const filteredExpenses = filterBusinessExpenses(expenses, filter);
  const { from, to } = resolveDateRange(filter);
  const fromTs = parseDateKey(from).getTime();
  const toTs = parseDateKey(to).getTime() + 864e5 - 1;
  const filteredPurchases = purchases.filter(
    (p) => p.createdAt >= fromTs && p.createdAt <= toTs,
  );

  let revenue = 0;
  let refunds = 0;
  let cogs = 0;
  let orderCount = 0;
  const byMethod: Record<PaymentMethod, number> = {
    cash: 0,
    card: 0,
    bank: 0,
    other: 0,
  };
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();

  for (const o of filteredOrders) {
    if (o.status === "refunded") {
      refunds += o.total;
      continue;
    }
    orderCount++;
    revenue += o.total;
    cogs += o.costTotal;
    byMethod[o.method] = (byMethod[o.method] ?? 0) + o.total;
    for (const l of o.lines) {
      const key = l.productId ?? l.name;
      const entry = prodMap.get(key) ?? { name: l.name, qty: 0, revenue: 0 };
      entry.qty += l.qty;
      entry.revenue += l.qty * l.price * (1 - l.discount / 100);
      prodMap.set(key, entry);
    }
  }

  const expenseTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const grossProfit = revenue - refunds - cogs;
  return {
    revenue,
    refunds,
    cogs,
    expenses: expenseTotal,
    grossProfit,
    netProfit: grossProfit - expenseTotal,
    orderCount,
    avgOrder: orderCount ? revenue / orderCount : 0,
    purchases: filteredPurchases.reduce((s, p) => s + p.total, 0),
    byMethod,
    byCategory: [...filteredExpenses.reduce((map, e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
      return map;
    }, new Map<string, number>())]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    topProducts: [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

export function lowStockProducts(products: Product[]): Product[] {
  return products
    .filter((p) => p.active && p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
}

/** Daily revenue + profit across the range (for dashboard charts). */
export function dailySales(
  orders: Order[],
  expenses: BusinessExpense[],
  from: string,
  to: string,
): { date: string; revenue: number; profit: number }[] {
  const map = new Map<string, { revenue: number; profit: number }>();
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    map.set(cursor, { revenue: 0, profit: 0 });
    cursor = addDaysKey(cursor, 1);
    guard++;
  }
  const { } = expenses; // expenses are reported separately
  void expenses;
  for (const o of orders) {
    if (o.status !== "completed") continue;
    const day = toLocalDateKey(new Date(o.createdAt));
    const bucket = map.get(day);
    if (!bucket) continue;
    bucket.revenue += o.total;
    bucket.profit += o.total - o.costTotal;
  }
  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export function nextOrderNumber(business: BusinessData): number {
  return business.orderCounter + 1;
}

export type { Order, Product, Customer, Supplier, Purchase, BusinessExpense, Transaction, SystemId };
