export type ID = string;

export type Priority = "low" | "medium" | "high";

export type TaskStatus =
  | "inbox"
  | "todo"
  | "in_progress"
  | "waiting"
  | "completed";

export type ProjectStatus = "planning" | "active" | "paused" | "done";

export type Recurrence =
  | { type: "daily" }
  | { type: "weekly"; weekdays?: number[] } // 0=Sun..6=Sat
  | { type: "monthly"; dayOfMonth: number }
  | { type: "weekdays" };

export type Subtask = {
  id: ID;
  title: string;
  completed: boolean;
};

export type Task = {
  id: ID;
  title: string;
  description?: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string; // yyyy-MM-dd
  dueTime?: string; // HH:mm
  projectId?: ID;
  processId?: ID;
  processRunId?: ID;
  goalId?: ID;
  tagIds: ID[];
  subtasks: Subtask[];
  recurrence?: Recurrence;
  reminder?: string; // HH:mm
  order: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type InboxItem = {
  id: ID;
  text: string;
  createdAt: number;
  organizedId?: ID;
  organizedType?: "task" | "project" | "goal" | "habit" | "process";
};

export type Project = {
  id: ID;
  name: string;
  description?: string;
  goalId?: ID;
  dueDate?: string;
  status: ProjectStatus;
  color?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type ProcessStep = {
  id: ID;
  title: string;
  description?: string;
  durationMin?: number;
  order: number;
};

export type Process = {
  id: ID;
  name: string;
  description?: string;
  steps: ProcessStep[];
  recurrence?: Recurrence;
  startDate?: string;
  endDate?: string;
  tagIds: ID[];
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ProcessRun = {
  id: ID;
  processId: ID;
  date: string; // yyyy-MM-dd
  startedAt: number;
  completedAt?: number;
};

export type Habit = {
  id: ID;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  schedule: Recurrence;
  timeOfDay?: "anytime" | "morning" | "afternoon" | "evening";
  targetPerDay?: number;
  completions: string[]; // yyyy-MM-dd list
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
};

export type Goal = {
  id: ID;
  title: string;
  description?: string;
  targetDate?: string;
  status: "active" | "achieved" | "dropped";
  color?: string;
  createdAt: number;
  updatedAt: number;
};

export type Tag = {
  id: ID;
  name: string;
  color?: string;
  createdAt: number;
};

export type Note = {
  id: ID;
  title: string;
  body?: string;
  createdAt: number;
  updatedAt: number;
};

export type CalendarEvent = {
  id: ID;
  title: string;
  date: string; // yyyy-MM-dd
  time?: string;
  kind: "event" | "deadline";
  linkedId?: ID;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type Currency = "USD" | "KHR";

export type AppSettings = {
  theme: "light" | "dark" | "system";
  name: string;
  weekStartsMonday: boolean;
  /** profile photo (compressed data URL) shown in the sidebar + settings */
  avatar?: string;
  /** display currency — amounts are always stored in USD */
  currency?: Currency;
  /** exchange rate: 1 USD = X KHR (riel has no subunits) */
  usdToKhr?: number;
};

/* ------------------------------------------------------------------ */
/* Systems (one app, three workspaces)                                 */
/* ------------------------------------------------------------------ */

export type SystemId = "life" | "expense" | "business" | "salon" | "admin";

/* ------------------------------------------------------------------ */
/* Expense system                                                      */
/* ------------------------------------------------------------------ */

export type TxType = "income" | "expense";

export type PaymentMethod = "cash" | "card" | "bank" | "other";

export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "bank", "other"];

export const EXPENSE_CATEGORIES = [
  "food",
  "transportation",
  "shopping",
  "bills",
  "education",
  "entertainment",
  "health",
  "rent",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_CATEGORIES = [
  "salary",
  "business",
  "gift",
  "investment",
  "other",
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export type Transaction = {
  id: ID;
  type: TxType;
  amount: number; // positive
  category: string; // ExpenseCategory | IncomeCategory | custom
  method: PaymentMethod;
  date: string; // yyyy-MM-dd
  note?: string;
  /** optional receipt/proof photo, stored as a compressed data URL */
  image?: string;
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/* Business / POS system                                               */
/* ------------------------------------------------------------------ */

export type Product = {
  id: ID;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  price: number; // sale price
  cost: number; // unit cost (COGS)
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  /** optional product photo, stored as a compressed data URL */
  image?: string;
  createdAt: number;
  updatedAt: number;
};

export type Customer = {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  /** optional avatar photo, stored as a compressed data URL */
  image?: string;
  createdAt: number;
  updatedAt: number;
};

export type Supplier = {
  id: ID;
  name: string;
  phone?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

/** A cart/order line. Cart lines and order lines share this shape. */
export type OrderLine = {
  productId?: ID;
  name: string;
  qty: number;
  price: number;
  cost: number;
  /** percent 0–100 off this line */
  discount: number;
};

export type HeldOrder = {
  id: ID;
  lines: OrderLine[];
  customerId?: ID;
  createdAt: number;
};

type OrderStatus = "completed" | "refunded";

export type Order = {
  id: ID;
  number: number; // sequential receipt number
  lines: OrderLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  costTotal: number; // COGS at sale time
  status: OrderStatus;
  customerId?: ID;
  method: PaymentMethod;
  amountPaid?: number;
  change?: number;
  refundedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export const BUSINESS_EXPENSE_CATEGORIES = [
  "rent",
  "electricity",
  "internet",
  "salary",
  "transportation",
  "supplier",
  "office",
  "other",
] as const;

export type BusinessExpenseCategory = (typeof BUSINESS_EXPENSE_CATEGORIES)[number];

export type PurchaseItem = { productId: ID; qty: number; cost: number };

export type Purchase = {
  id: ID;
  supplierId?: ID;
  items: PurchaseItem[];
  total: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type BusinessExpense = {
  id: ID;
  category: string;
  amount: number;
  method: PaymentMethod;
  date: string; // yyyy-MM-dd
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type BusinessData = {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  orders: Order[];
  heldOrders: HeldOrder[];
  purchases: Purchase[];
  expenses: BusinessExpense[];
  /** receipt number counter */
  orderCounter: number;
  /** quote number counter */
  quoteCounter: number;
  staff: StaffMember[];
  quotes: Quote[];
  /** percent 0–100, applied at POS when tax is enabled */
  taxRate: number;
  taxEnabled: boolean;
  shopName: string;
};

/* ------------------------------------------------------------------ */
/* Expense extensions: accounts, recurring transactions, debts         */
/* ------------------------------------------------------------------ */

export const ACCOUNT_KINDS = ["cash", "bank", "card", "mobile", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** A wallet / bank / mobile-money account with a manually tracked balance. */
export type Account = {
  id: ID;
  name: string;
  kind: AccountKind;
  balance: number;
  color?: string;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
};

/**
 * A monthly repeating transaction (rent, bills, salary). Occurrences are
 * posted as real transactions when the Recurring page (or app) notices
 * they are due — `lastRun` stamps the most recent posted occurrence.
 */
export type RecurringTx = {
  id: ID;
  type: TxType;
  amount: number;
  category: string;
  method: PaymentMethod;
  /** first month this rule applies (yyyy-MM-dd) */
  startDate: string;
  /** 1–31; shorter months clamp to their last day */
  dayOfMonth: number;
  note?: string;
  /** last posted occurrence (yyyy-MM-dd); absent until first run */
  lastRun?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Money you owe (payable) or money owed to you (receivable). */
export type Debt = {
  id: ID;
  name: string;
  direction: "payable" | "receivable";
  total: number;
  paid: number;
  dueDate?: string;
  note?: string;
  settledAt?: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * A named pot of money inside the expense system (emergency fund, phone,
 * motorbike…). `saved` is the current balance; contributions and withdrawals
 * are kept in `contributions` so the Savings page can show a small history.
 */
export type SavingGoal = {
  id: ID;
  name: string;
  /** target amount in USD (stored currency) */
  target: number;
  saved: number;
  color?: string;
  /** optional emoji/icon placeholder for future icon pickers */
  emoji?: string;
  /** target date (yyyy-MM-dd) — optional deadline for the goal */
  targetDate?: string;
  note?: string;
  reachedAt?: number;
  archived?: boolean;
  contributions: {
    id: ID;
    /** money in (+) or out (-) */
    amount: number;
    date: string; // yyyy-MM-dd
    note?: string;
    createdAt: number;
  }[];
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/* Business extensions: staff, quotes                                  */
/* ------------------------------------------------------------------ */

export type StaffMember = {
  id: ID;
  name: string;
  role?: string;
  phone?: string;
  /** monthly salary; 0 = not salaried */
  salary: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

/** A price estimate for a custom order; accepted quotes convert to sales. */
export type Quote = {
  id: ID;
  number: number;
  customerName: string;
  lines: OrderLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  costTotal: number;
  status: QuoteStatus;
  /** id of the order created when the quote was accepted */
  convertedOrderId?: ID;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
};

/* ------------------------------------------------------------------ */
/* Salon Management system                                             */
/* ------------------------------------------------------------------ */

/** Category grouping services and products (hair, nails, retail…). */
export type SalonCategory = {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
};

/** Offered service (haircut, coloring, manicure…). */
export type SalonService = {
  id: string;
  name: string;
  /** price in USD (stored currency) */
  price: number;
  /** duration in minutes */
  duration: number;
  categoryId?: string;
  image?: string;
  color?: string;
  active?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SalonCustomer = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  visits: number;
  /** lifetime spend in USD */
  spent: number;
  /** ISO date of last visit */
  lastVisit?: string;
  createdAt: number;
  updatedAt: number;
};

export type SalonStaff = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  /** share of service revenue, 0-100 */
  commission: number;
  active?: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Retail product sold at the counter (shampoo, cream…). Tracks stock. */
export type SalonProduct = {
  id: string;
  name: string;
  price: number;
  cost?: number;
  stock: number;
  /** alert when stock falls to or below this */
  lowStockThreshold: number;
  categoryId?: string;
  sku?: string;
  image?: string;
  active?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SalonAppointmentStatus = "booked" | "done" | "cancelled" | "no_show";

/** Upcoming visit reservation (customer books a time; consumed at the POS). */
export type SalonAppointment = {
  id: string;
  customerId?: string;
  /** free-text name for bookings without a saved customer */
  customerName?: string;
  phone?: string;
  serviceId: string;
  staffId?: string;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  /** HH:mm 24h */
  time: string;
  status: SalonAppointmentStatus;
  /** price captured at booking (USD) */
  price: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

/** One line in a walk-in sale: a service (performed) or a product (stock −1). */
export type SalonSaleLine = {
  /** SalonService id when kind="service", SalonProduct id when kind="product" */
  itemId: string;
  kind: "service" | "product";
  name: string;
  /** unit price captured at sale time */
  price: number;
  qty: number;
  /** percent 0-100 */
  discount: number;
  /** staff who performed the service (services only) */
  staffId?: string;
};

/** A completed walk-in sale (no booking). */
export type SalonSale = {
  id: string;
  /** sequential receipt number */
  number: number;
  customerId?: string;
  lines: SalonSaleLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  method: PaymentMethod;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  createdAt: number;
};

export type SalonData = {
  shopName: string;
  categories: SalonCategory[];
  services: SalonService[];
  products: SalonProduct[];
  customers: SalonCustomer[];
  staff: SalonStaff[];
  appointments: SalonAppointment[];
  sales: SalonSale[];
  /** last receipt number issued */
  saleCounter: number;
};

export function salonLineTotal(l: SalonSaleLine): number {
  const gross = l.price * l.qty;
  return Math.round(gross * (1 - l.discount / 100) * 100) / 100;
}

export const SALON_SERVICE_COLORS = ["#ec4899", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#14b8a6"];

export type AppData = {
  version: number;
  seeded: boolean;
  settings: AppSettings;
  /** last system the user entered (system selector pre-selects it) */
  activeSystem: SystemId | null;
  /** monthly spending budgets: expense category name → amount per month */
  budgets: Record<string, number>;
  tasks: Task[];
  inboxItems: InboxItem[];
  projects: Project[];
  processes: Process[];
  processRuns: ProcessRun[];
  habits: Habit[];
  goals: Goal[];
  tags: Tag[];
  notes: Note[];
  calendarEvents: CalendarEvent[];
  transactions: Transaction[];
  accounts: Account[];
  recurring: RecurringTx[];
  debts: Debt[];
  /** savings pots tracked inside the expense system */
  savings: SavingGoal[];
  business: BusinessData;
  /** salon management system */
  salon: SalonData;
};

export const PRIORITIES: Priority[] = ["low", "medium", "high"];
export const TASK_STATUSES: TaskStatus[] = [
  "inbox",
  "todo",
  "in_progress",
  "waiting",
  "completed",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "Todo",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
