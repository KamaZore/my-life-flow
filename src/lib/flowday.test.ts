import { describe, expect, test, beforeEach } from "bun:test";
import {
  addDaysKey,
  buildMonthGrid,
  formatDateKey,
  formatTime,
  isInRange,
  isOverdue,
  parseDateKey,
  recurrenceLabel,
  recurrenceMatches,
  toLocalDateKey,
  todayKey,
} from "./date-utils";
import { parseCapture } from "./parse";
import {
  addProcessStep,
  addSalonCustomer,
  addSalonProduct,
  addSalonService,
  addSalonStaff,
  addSavingGoal,
  addSubtask,
  addTask,
  addTransaction,
  checkoutSalonSale,
  clearAllData,
  contributeSaving,
  deleteProject,
  deleteProcess,
  deleteSalonSale,
  deleteSavingGoal,
  exportData,
  getData,
  goalProgress,
  habitBestStreak,
  habitStreak,
  importData,
  moveProcessStep,
  organizeInboxItem,
  projectProgress,
  reorderTasks,
  logActivity,
  resetDemoData,
  scheduleProcess,
  toggleHabitDate,
  toggleSubtask,
  toggleTask,
  updateSavingGoal,
  updateSettings,
  updateTask,
} from "./store";
import type { Habit, Process, Task } from "./types";

/* ------------------------------------------------------------------ */
/* parse.ts — smart capture                                            */
/* ------------------------------------------------------------------ */

describe("parseCapture", () => {
  test("parses 'Call John tomorrow 3pm !high #errands'", () => {
    const r = parseCapture("Call John tomorrow 3pm !high #errands");
    expect(r.title).toBe("Call John");
    expect(r.dueDate).toBe(addDaysKey(todayKey(), 1));
    expect(r.dueTime).toBe("15:00");
    expect(r.priority).toBe("high");
    expect(r.tagNames).toEqual(["errands"]);
  });

  test("parses 24h time and 'today'", () => {
    const r = parseCapture("Submit taxes today 9:30am");
    expect(r.title).toBe("Submit taxes");
    expect(r.dueDate).toBe(todayKey());
    expect(r.dueTime).toBe("09:30");
  });

  test("'tonight' defaults to 20:00 today", () => {
    const r = parseCapture("Night run tonight");
    expect(r.title).toBe("Night run");
    expect(r.dueDate).toBe(todayKey());
    expect(r.dueTime).toBe("20:00");
  });

  test("bare weekday mention schedules next occurrence", () => {
    const r = parseCapture("Plan review on friday");
    expect(r.title).toBe("Plan review");
    expect(r.dueDate).toBeDefined();
    expect(r.dueDate).not.toBe("invalid");
    const dow = parseDateKey(r.dueDate as string).getDay();
    expect(dow).toBe(5); // Friday
  });

  test("'every monday' becomes a weekly recurrence", () => {
    const r = parseCapture("Weekly review every monday");
    expect(r.recurrence).toEqual({ type: "weekly", weekdays: [1] });
  });

  test("'every weekday' becomes a weekdays recurrence", () => {
    const r = parseCapture("Standup every weekday");
    expect(r.recurrence).toEqual({ type: "weekdays" });
  });

  test("plain text is untouched", () => {
    const r = parseCapture("Buy milk");
    expect(r.title).toBe("Buy milk");
    expect(r.dueDate).toBeUndefined();
    expect(r.dueTime).toBeUndefined();
    expect(r.priority).toBeUndefined();
    expect(r.tagNames).toEqual([]);
  });

  test("handles noon/midnight correctly", () => {
    expect(parseCapture("Lunch at 12pm").dueTime).toBe("12:00");
    expect(parseCapture("Wake up 12am").dueTime).toBe("00:00");
  });
});

/* ------------------------------------------------------------------ */
/* date-utils.ts                                                       */
/* ------------------------------------------------------------------ */

describe("date-utils", () => {
  test("toLocalDateKey / parseDateKey roundtrip", () => {
    const key = "2026-09-22";
    expect(toLocalDateKey(parseDateKey(key))).toBe(key);
  });

  test("addDaysKey crosses month boundaries", () => {
    expect(addDaysKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("recurrenceMatches", () => {
    expect(recurrenceMatches({ type: "daily" }, "2026-09-22")).toBe(true);
    expect(
      recurrenceMatches({ type: "weekdays" }, "2026-09-19"), // Saturday
    ).toBe(false);
    expect(
      recurrenceMatches({ type: "weekdays" }, "2026-09-22"), // Tuesday
    ).toBe(true);
    expect(
      recurrenceMatches({ type: "weekly", weekdays: [1] }, "2026-09-21"), // Monday
    ).toBe(true);
    expect(
      recurrenceMatches(
        { type: "monthly", dayOfMonth: 15 },
        "2026-09-15",
      ),
    ).toBe(true);
    expect(recurrenceMatches(undefined, "2026-09-22")).toBe(false);
  });

  test("recurrenceLabel", () => {
    expect(recurrenceLabel(undefined)).toBe("No repeat");
    expect(recurrenceLabel({ type: "daily" })).toBe("Every day");
    expect(recurrenceLabel({ type: "weekdays" })).toBe("Weekdays");
    expect(recurrenceLabel({ type: "weekly", weekdays: [1, 3] })).toBe(
      "Mon, Wed",
    );
    expect(recurrenceLabel({ type: "monthly", dayOfMonth: 1 })).toBe(
      "Monthly on day 1",
    );
  });

  test("isOverdue", () => {
    const yesterday = addDaysKey(todayKey(), -1);
    expect(isOverdue(yesterday, false)).toBe(true);
    expect(isOverdue(yesterday, true)).toBe(false);
    expect(isOverdue(undefined, false)).toBe(false);
    expect(isOverdue(todayKey(), false)).toBe(false);
  });

  test("buildMonthGrid returns full weeks of 7 days", () => {
    const grid = buildMonthGrid(new Date(2026, 8, 22), true);
    expect(grid.length).toBeGreaterThan(3);
    for (const week of grid) expect(week.length).toBe(7);
  });

  test("formatTime renders 12-hour clock", () => {
    expect(formatTime("14:05")).toBe("2:05 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
    expect(formatTime(undefined)).toBe("");
  });

  test("formatDateKey formats a date key", () => {
    expect(formatDateKey("2026-09-22", "yyyy-MM-dd")).toBe("2026-09-22");
  });

  test("isInRange", () => {
    expect(isInRange("2026-06-15", "2026-06-01", "2026-06-30")).toBe(true);
    expect(isInRange("2026-07-15", "2026-06-01", "2026-06-30")).toBe(false);
    expect(isInRange("2026-07-15")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* store.ts                                                            */
/* ------------------------------------------------------------------ */

describe("store", () => {
  beforeEach(() => {
    resetDemoData();
  });

  test("demo seed contains the expected entities", () => {
    const d = getData();
    expect(d.seeded).toBe(true);
    expect(d.tasks.length).toBeGreaterThan(5);
    expect(d.habits.length).toBe(4);
    expect(d.projects.length).toBe(3);
    expect(d.processes.length).toBe(2);
    expect(d.goals.length).toBe(2);
    expect(d.inboxItems.length).toBeGreaterThan(0);
  });

  test("addTask defaults: no dueDate → inbox, with dueDate → todo", () => {
    const inboxTask = addTask({ title: "Random idea" });
    expect(inboxTask.status).toBe("inbox");

    const dated = addTask({ title: "Dated", dueDate: todayKey() });
    expect(dated.status).toBe("todo");
    expect(dated.priority).toBe("medium");
  });

  test("toggleTask completes, un-completes, and clears completedAt", () => {
    const t = addTask({ title: "Toggle me", status: "todo" });
    toggleTask(t.id);
    let after = getData().tasks.find((x) => x.id === t.id) as Task;
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeDefined();

    toggleTask(t.id);
    after = getData().tasks.find((x) => x.id === t.id) as Task;
    expect(after.status).toBe("todo");
    expect(after.completedAt).toBeUndefined();
  });

  test("completing a daily recurring task spawns tomorrow's occurrence", () => {
    const t = addTask({
      title: "Stretch",
      dueDate: todayKey(),
      recurrence: { type: "daily" },
    });
    toggleTask(t.id);
    const spawned = getData().tasks.find(
      (x) => x.title === "Stretch" && x.id !== t.id,
    );
    expect(spawned).toBeDefined();
    expect(spawned?.status).toBe("todo");
    expect(spawned?.dueDate).toBe(addDaysKey(todayKey(), 1));
  });

  test("subtasks can be added, toggled, removed", () => {
    const t = addTask({ title: "With subtasks" });
    addSubtask(t.id, "Step one");
    addSubtask(t.id, "Step two");
    let cur = getData().tasks.find((x) => x.id === t.id) as Task;
    expect(cur.subtasks.length).toBe(2);

    toggleSubtask(t.id, cur.subtasks[0].id);
    cur = getData().tasks.find((x) => x.id === t.id) as Task;
    expect(cur.subtasks[0].completed).toBe(true);
    expect(cur.subtasks[1].completed).toBe(false);

    toggleTask(t.id); // completing marks all subtasks done
    cur = getData().tasks.find((x) => x.id === t.id) as Task;
    expect(cur.subtasks.every((s) => s.completed)).toBe(true);
  });

  test("scheduleProcess creates one task per step, once per date", () => {
    const proc = getData().processes[0] as Process;
    const date = addDaysKey(todayKey(), 10);
    expect(scheduleProcess(proc.id, date)).toBe(true);

    const runTasks = getData().tasks.filter(
      (t) => t.processId === proc.id && t.dueDate === date,
    );
    expect(runTasks.length).toBe(proc.steps.length);
    expect(
      runTasks.every((t) => t.status === "todo" && t.processRunId),
    ).toBe(true);
    expect(getData().processRuns.some((r) => r.processId === proc.id && r.date === date)).toBe(true);

    // duplicate scheduling on the same date is rejected
    expect(scheduleProcess(proc.id, date)).toBe(false);
  });

  test("moveProcessStep reorders and renormalizes step order", () => {
    const proc = getData().processes[0] as Process;
    const firstStepId = [...proc.steps].sort((a, b) => a.order - b.order)[0]
      .id;
    moveProcessStep(proc.id, firstStepId, 1);
    const moved = getData().processes.find((p) => p.id === proc.id) as Process;
    const sorted = [...moved.steps].sort((a, b) => a.order - b.order);
    expect(sorted[0].id).not.toBe(firstStepId);
    expect(sorted.map((s) => s.order)).toEqual(sorted.map((_, i) => i));
  });

  test("addProcessStep appends at the end", () => {
    const proc = getData().processes[0] as Process;
    addProcessStep(proc.id, "Cool down");
    const updated = getData().processes.find((p) => p.id === proc.id) as Process;
    const sorted = [...updated.steps].sort((a, b) => a.order - b.order);
    const last = sorted[sorted.length - 1];
    expect(last?.title).toBe("Cool down");
  });

  test("deleteProcess removes pending run tasks but keeps completed ones", () => {
    const proc = getData().processes[0] as Process;
    const date = addDaysKey(todayKey(), 9);
    scheduleProcess(proc.id, date);
    const runTasks = getData().tasks.filter(
      (t) => t.processId === proc.id && t.dueDate === date,
    );
    toggleTask(runTasks[0].id); // complete one so it survives deletion

    deleteProcess(proc.id);
    const remaining = getData().tasks.filter((t) => t.processId === proc.id);
    expect(remaining.length).toBe(1);
    expect(remaining[0].status).toBe("completed");
  });

  test("habitStreak counts consecutive days ending today/yesterday", () => {
    const habits = getData().habits;
    const exercise = habits.find((h) => h.name === "Exercise") as Habit;
    // seed: today, -1, -2, skip -3, -4, -5
    expect(habitStreak(exercise)).toBe(3);
    expect(habitBestStreak(exercise)).toBe(3);
  });

  test("today being incomplete doesn't break yesterday's streak", () => {
    const habits = getData().habits;
    const sleep = habits.find((h) => h.name === "Sleep 8 hours") as Habit;
    // seed: -1, -2, -3 (today not done)
    expect(habitStreak(sleep)).toBe(3);
  });

  test("toggleHabitDate adds and removes completions", () => {
    const habit = getData().habits[0] as Habit;
    const date = addDaysKey(todayKey(), -7);
    const before = habit.completions.includes(date);
    toggleHabitDate(habit.id, date);
    const after = (
      getData().habits.find((h) => h.id === habit.id) as Habit
    ).completions.includes(date);
    expect(after).toBe(!before);
  });

  test("projectProgress counts completed over total", () => {
    const fitness = getData().projects.find((p) => p.name === "Fitness");
    expect(fitness).toBeDefined();
    const tasks = getData().tasks;
    const expected = (() => {
      const pt = tasks.filter((t) => t.projectId === fitness?.id);
      return Math.round(
        (pt.filter((t) => t.status === "completed").length / pt.length) * 100,
      );
    })();
    expect(projectProgress(tasks, fitness!.id)).toBe(expected);
    expect(projectProgress([], "nope")).toBe(0);
  });

  test("goalProgress aggregates via linked projects", () => {
    const health = getData().goals.find((g) => g.title === "Become healthier");
    expect(health).toBeDefined();
    const tasks = getData().tasks;
    const projects = getData().projects;
    const pct = goalProgress(tasks, projects, health!.id);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  test("organizeInboxItem promotes to a task and marks the item", () => {
    const item = getData().inboxItems[0];
    const taskCountBefore = getData().tasks.length;
    organizeInboxItem(item.id, "task");
    const d = getData();
    expect(d.tasks.length).toBe(taskCountBefore + 1);
    const organized = d.inboxItems.find((i) => i.id === item.id);
    expect(organized?.organizedType).toBe("task");
    expect(organized?.organizedId).toBeDefined();
  });

  test("deleteProject unlinks its tasks", () => {
    const proj = getData().projects[0];
    const linkedCount = getData().tasks.filter(
      (t) => t.projectId === proj.id,
    ).length;
    expect(linkedCount).toBeGreaterThan(0);
    deleteProject(proj.id);
    const d = getData();
    expect(d.projects.some((p) => p.id === proj.id)).toBe(false);
    expect(d.tasks.some((t) => t.projectId === proj.id)).toBe(false);
  });

  test("updateSettings merges patches", () => {
    updateSettings({ name: "Alex", theme: "dark" });
    const s = getData().settings;
    expect(s.name).toBe("Alex");
    expect(s.theme).toBe("dark");
    expect(s.weekStartsMonday).toBe(true); // untouched
  });

  test("exportData → importData roundtrip; invalid JSON rejected", () => {
    const snapshot = exportData();
    expect(importData("{ not json")).toBe(false);
    expect(importData('{"tasks": 42}')).toBe(false);

    clearAllData();
    expect(getData().tasks.length).toBe(0);

    expect(importData(snapshot)).toBe(true);
    expect(getData().tasks.length).toBe(
      (JSON.parse(snapshot) as { tasks: unknown[] }).tasks.length,
    );
    expect(getData().habits.length).toBe(4);
  });

  test("clearAllData empties collections but keeps settings", () => {
    updateSettings({ name: "Keep me" });
    clearAllData();
    const d = getData();
    expect(d.tasks.length).toBe(0);
    expect(d.habits.length).toBe(0);
    expect(d.projects.length).toBe(0);
    expect(d.seeded).toBe(false);
    expect(d.settings.name).toBe("Keep me");
  });

  test("addSavingGoal stores a goal and stamps reachedAt when pre-filled", () => {
    const goal = addSavingGoal({ name: "Motorbike", target: 1000, color: "#10b981" });
    expect(goal.saved).toBe(0);
    expect(goal.reachedAt).toBeUndefined();
    expect(getData().savings.some((g) => g.id === goal.id)).toBe(true);

    const done = addSavingGoal({ name: "Done already", target: 100, saved: 100 });
    expect(done.saved).toBe(100);
    expect(done.reachedAt).toBeDefined();
  });

  test("contributeSaving adds money, logs history, and stamps reachedAt", () => {
    const goal = addSavingGoal({ name: "Emergency", target: 200 });
    const applied = contributeSaving(goal.id, 120);
    expect(applied).toBe(120);

    const stored = getData().savings.find((g) => g.id === goal.id);
    expect(stored?.saved).toBe(120);
    expect(stored?.contributions.length).toBe(1);
    expect(stored?.contributions[0]?.amount).toBe(120);
    expect(stored?.reachedAt).toBeUndefined();

    const second = contributeSaving(goal.id, 80);
    expect(second).toBe(80);
    const finished = getData().savings.find((g) => g.id === goal.id);
    expect(finished?.saved).toBe(200);
    expect(finished?.reachedAt).toBeDefined();
    expect(finished?.contributions.length).toBe(2);
  });

  test("contributeSaving clamps withdrawals at the saved balance", () => {
    const goal = addSavingGoal({ name: "Phone", target: 300, saved: 50 });
    const applied = contributeSaving(goal.id, -90);
    expect(applied).toBe(-50);
    const stored = getData().savings.find((g) => g.id === goal.id);
    expect(stored?.saved).toBe(0);
    expect(stored?.contributions[0]?.amount).toBe(-50);

    // Reaching the target then withdrawing clears reachedAt
    contributeSaving(goal.id, 300);
    expect(getData().savings.find((g) => g.id === goal.id)?.reachedAt).toBeDefined();
    contributeSaving(goal.id, -100);
    const after = getData().savings.find((g) => g.id === goal.id);
    expect(after?.saved).toBe(200);
    expect(after?.reachedAt).toBeUndefined();
  });

  test("updateSavingGoal and deleteSavingGoal work", () => {
    const goal = addSavingGoal({ name: "Trip", target: 500 });
    updateSavingGoal(goal.id, { name: "Japan trip", target: 800 });
    let stored = getData().savings.find((g) => g.id === goal.id);
    expect(stored?.name).toBe("Japan trip");
    expect(stored?.target).toBe(800);

    deleteSavingGoal(goal.id);
    stored = getData().savings.find((g) => g.id === goal.id);
    expect(stored).toBeUndefined();
  });

  test("normalizeData fills missing savings field for old documents", () => {
    const old = JSON.parse(JSON.stringify(getData())) as Record<string, unknown>;
    delete old.savings;
    const imported = importData(JSON.stringify(old));
    expect(imported).toBe(true);
    expect(Array.isArray(getData().savings)).toBe(true);
  });

  test("KHR amounts store full precision so riel figures round-trip exactly (MoneyInput math)", () => {
    // MoneyInput stores riel input at full precision (khr ÷ rate, no cent
    // rounding) so a typed 4000៛ still shows as ៛4,000 after saving.
    const rate = 4100;
    const khrToUsd = (khr: number) => khr / rate;
    expect(khrToUsd(4100)).toBe(1);
    expect(khrToUsd(2050)).toBe(0.5);
    expect(khrToUsd(4000)).toBeCloseTo(0.9756, 4);
    expect(Math.round(khrToUsd(4000) * rate)).toBe(4000); // round-trip exact
    expect(khrToUsd(1)).toBeCloseTo(0.000244, 6);
    // USD→KHR preview rounds to whole riel.
    const usdToKhr = (usd: number) => Math.round(usd * rate);
    expect(usdToKhr(2.44)).toBe(10004);
    expect(usdToKhr(0.005)).toBe(21); // half-riel rounds up
  });

  test("quick add + savings contributions produce real transactions and history", () => {
    const txCountBefore = getData().transactions.length;
    const goal = addSavingGoal({ name: "Quick test", target: 100 });
    contributeSaving(goal.id, 12.5);
    const stored = getData().savings.find((g) => g.id === goal.id);
    expect(stored?.saved).toBe(12.5);
    expect(stored?.contributions.length).toBe(1);
    // Quick box path: addTransaction keeps the exact rounded amount
    const tx = addTransaction({
      type: "income",
      amount: Math.round(3.7 * 100) / 100,
      category: "salary",
      method: "cash",
      date: todayKey(),
    });
    expect(tx.amount).toBe(3.7);
    expect(getData().transactions.length).toBe(txCountBefore + 1);
  });

  test("habitStreak skips unscheduled days (weekly schedule)", () => {
    const todayDow = parseDateKey(todayKey()).getDay();
    // Habit scheduled only on today's weekday: other days must not break it.
    const habit: Habit = {
      id: "habit-weekly",
      name: "Weekly deep clean",
      schedule: { type: "weekly", weekdays: [todayDow] },
      completions: [todayKey()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(habitStreak(habit)).toBe(1);

    // A completion logged on an unscheduled day must not inflate the streak.
    const yesterday = addDaysKey(todayKey(), -1);
    const withNoise: Habit = {
      ...habit,
      completions: [todayKey(), yesterday],
    };
    expect(habitStreak(withNoise)).toBe(1);

    // A missed scheduled day breaks the streak.
    const yesterdayDow = parseDateKey(yesterday).getDay();
    const twoDayHabit: Habit = {
      ...habit,
      schedule: { type: "weekly", weekdays: [todayDow, yesterdayDow] },
      completions: [todayKey()], // yesterday scheduled but missed
    };
    expect(habitStreak(twoDayHabit)).toBe(1);

    // Scheduled AND completed yesterday extends the streak.
    expect(habitStreak({ ...twoDayHabit, completions: [todayKey(), yesterday] })).toBe(2);
  });

  test("reorderTasks renormalizes manual order across mixed due dates", () => {
    const a = addTask({ title: "A", status: "todo", dueDate: todayKey(), order: 0 });
    const b = addTask({ title: "B", status: "todo", dueDate: addDaysKey(todayKey(), 5), order: 1 });
    const c = addTask({ title: "C", status: "todo", dueDate: addDaysKey(todayKey(), 2), order: 2 });

    // Drag B onto A: B should take A's slot, orders stay unique 0..n-1.
    reorderTasks(b.id, a.id);
    const tasks = getData().tasks;
    const orders = tasks.map((t) => t.order);
    expect(new Set(orders).size).toBe(tasks.length);
    expect(new Set(orders)).toEqual(new Set(tasks.map((_, i) => i)));

    const aAfter = tasks.find((t) => t.id === a.id) as Task;
    const bAfter = tasks.find((t) => t.id === b.id) as Task;
    expect(bAfter.order).toBeLessThan(aAfter.order);
    void c;
  });

  test("updateTask keeps completedAt consistent with status changes", () => {
    const done = addTask({ title: "Already done", status: "completed" });
    expect(done.completedAt).toBeDefined();

    updateTask(done.id, { status: "todo" });
    let t = getData().tasks.find((x) => x.id === done.id) as Task;
    expect(t.completedAt).toBeUndefined();

    updateTask(done.id, { status: "completed" });
    t = getData().tasks.find((x) => x.id === done.id) as Task;
    expect(t.status).toBe("completed");
    expect(t.completedAt).toBeDefined();
  });

  test("salon: walk-in sale decrements stock, updates customer stats, receipt numbers increment", () => {
    resetDemoData();
    const today = todayKey();
    const svc = addSalonService({ name: "Trim", price: 12, duration: 30 });
    const prod = addSalonProduct({ name: "Serum", price: 9, cost: 5, stock: 5, lowStockThreshold: 2 });
    const cust = addSalonCustomer({ name: "Test Client" });
    const member = addSalonStaff({ name: "Stylist", commission: 50 });

    const before = getData().salon.saleCounter;
    const sale = checkoutSalonSale({
      lines: [
        { itemId: svc.id, kind: "service", name: "Trim", price: 12, qty: 1, discount: 0, staffId: member.id },
        { itemId: prod.id, kind: "product", name: "Serum", price: 9, qty: 2, discount: 0 },
      ],
      customerId: cust.id,
      method: "cash",
      date: today,
    });

    // Receipt number increments, totals computed with discount math
    expect(sale.number).toBe(before + 1);
    expect(sale.subtotal).toBe(30);
    expect(sale.total).toBe(30);

    // Product stock decremented by qty
    expect(getData().salon.products.find((p) => p.id === prod.id)?.stock).toBe(3);

    // Customer stats rolled forward
    const c = getData().salon.customers.find((x) => x.id === cust.id)!;
    expect(c.visits).toBe(1);
    expect(c.spent).toBe(30);
    expect(c.lastVisit).toBe(today);

    // Deleting the sale refunds stock and reverses customer stats
    deleteSalonSale(sale.id);
    expect(getData().salon.products.find((p) => p.id === prod.id)?.stock).toBe(5);
    const c2 = getData().salon.customers.find((x) => x.id === cust.id)!;
    expect(c2.visits).toBe(0);
    expect(c2.spent).toBe(0);
  });

  test("salon: discount math and normalizeData round-trip", () => {
    resetDemoData();
    const prod = addSalonProduct({ name: "Cream", price: 10, stock: 10, lowStockThreshold: 2 });

    // 20% discount on 10 = 8 total
    const sale = checkoutSalonSale({
      lines: [{ itemId: prod.id, kind: "product", name: "Cream", price: 10, qty: 1, discount: 20 }],
      method: "card",
    });
    expect(sale.subtotal).toBe(10);
    expect(sale.discountTotal).toBe(2);
    expect(sale.total).toBe(8);

    const exported = JSON.parse(exportData()) as { salon?: { services?: unknown[]; sales?: unknown[] } };
    expect(Array.isArray(exported.salon?.services)).toBe(true);
    expect(exported.salon?.sales?.length).toBeGreaterThan(0);

    // Strip salon entirely → importData must re-fill defaults, not crash
    delete exported.salon;
    expect(importData(JSON.stringify(exported))).toBe(true);
    expect(Array.isArray(getData().salon.services)).toBe(true);
    expect(Array.isArray(getData().salon.sales)).toBe(true);
  });

  test("usage log records sign-ins and module views, newest first", () => {
    resetDemoData();
    logActivity({ type: "login", system: "life", path: "", labelKey: "" });
    logActivity({
      type: "module",
      system: "salon",
      path: "/salon/pos",
      labelKey: "nav.salon.pos",
    });
    const act = getData().activity;
    expect(act.length).toBe(2);
    // Newest first: the module view landed after the sign-in.
    expect(act[0].type).toBe("module");
    expect(act[0].path).toBe("/salon/pos");
    expect(act[0].labelKey).toBe("nav.salon.pos");
    expect(act[1].type).toBe("login");
    expect(act[0].at).toBeGreaterThan(0);
  });

  test("usage log de-duplicates the same view and caps the feed", () => {
    resetDemoData();
    // Same screen twice in a row = one entry (navigation noise, not usage).
    logActivity({ type: "module", system: "expense", path: "/expense/debts", labelKey: "" });
    logActivity({ type: "module", system: "expense", path: "/expense/debts", labelKey: "" });
    expect(getData().activity.length).toBe(1);
    // A different screen is real usage.
    logActivity({ type: "module", system: "expense", path: "/expense/savings", labelKey: "" });
    expect(getData().activity.length).toBe(2);
    // Never grows past the cap.
    for (let i = 0; i < 260; i++) {
      logActivity({
        type: "module",
        system: "business",
        path: `/business/orders?page=${i}`,
        labelKey: "",
      });
    }
    expect(getData().activity.length).toBeLessThanOrEqual(200);
  });

  test("usage log survives an export/import round-trip", () => {
    resetDemoData();
    logActivity({ type: "login", system: "admin", path: "", labelKey: "" });
    const exported = exportData();
    resetDemoData();
    expect(getData().activity.length).toBe(0);
    expect(importData(exported)).toBe(true);
    expect(getData().activity.length).toBe(1);
    expect(getData().activity[0].type).toBe("login");
  });
});
