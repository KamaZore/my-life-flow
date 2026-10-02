import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Flame,
  Focus,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { formatDateKey, todayKey, addDaysKey } from "@/lib/date-utils";
import { addTask, recurrenceMatches, toggleTask, useAppData } from "@/lib/store";
import { money, useCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Workspace() {
  const { t } = useI18n();
  const { user, signOut, can } = useAuth();
  const navigate = useNavigate();
  const data = useAppData();
  useCurrency();
  const [quickTitle, setQuickTitle] = useState("");
  const today = todayKey();
  const [selectedDay, setSelectedDay] = useState(today);

  const todayTasks = useMemo(
    () => data.tasks.filter((task) => task.dueDate === selectedDay && task.status !== "inbox"),
    [data.tasks, selectedDay],
  );
  const done = todayTasks.filter((task) => task.status === "completed").length;
  const progress = todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0;
  const activeGoals = data.goals.filter((goal) => goal.status === "active");
  const monthExpenses = data.transactions
    .filter((tx) => tx.type === "expense" && tx.date.startsWith(today.slice(0, 7)))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const todayHabits = data.habits.filter((habit) => recurrenceMatches(habit.schedule, today));
  const completedHabits = todayHabits.filter((habit) => habit.completions.includes(today)).length;
  const upcoming = data.calendarEvents
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  function submitQuickTask(event: FormEvent) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    addTask({ title, dueDate: selectedDay, status: "todo" });
    setQuickTitle("");
  }

  const greeting = new Date().getHours() < 12 ? t("today.greeting.morning") : new Date().getHours() < 18 ? t("today.greeting.afternoon") : t("today.greeting.evening");
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="workspace-shell min-h-dvh bg-[#f7f8fc] text-slate-950 dark:bg-[#11131c] dark:text-slate-50">
      <div className="border-b border-indigo-100 bg-white/80 px-4 py-2 text-center text-xs font-medium text-slate-500 backdrop-blur dark:border-white/10 dark:bg-white/[.04] dark:text-slate-400">
        {t("workspace.banner")}
      </div>
      <aside className="workspace-sidebar hidden lg:flex">
        <Link to="/workspace" className="flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-600/25">F</span>
          <span className="text-lg font-extrabold tracking-tight">Flowday</span>
        </Link>
        <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{t("workspace.title")}</div>
        <nav className="mt-3 space-y-1">
          <SidebarItem icon={LayoutGrid} label={t("workspace.overview")} active />
          <SidebarItem icon={Target} label={t("goals.title")} onClick={() => navigate("/life/goals")} />
          <SidebarItem icon={CalendarDays} label={t("workspace.calendar")} onClick={() => navigate("/life/calendar")} />
          {can("expense") && (
            <SidebarItem icon={WalletCards} label={t("workspace.money")} onClick={() => navigate("/expense/dashboard")} />
          )}
        </nav>
        <div className="mt-auto space-y-1 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <SidebarItem icon={Settings} label={t("workspace.settings")} onClick={() => navigate("/life/settings")} />
          <SidebarItem icon={LogOut} label={t("workspace.signOut")} onClick={() => void signOut()} />
        </div>
      </aside>

      <main className="workspace-main">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatDateKey(today, "EEEE, MMMM d")}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}, {firstName} <span aria-hidden>✦</span></h1>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" size="icon" className="rounded-xl"><Sun className="size-4 text-amber-500" /></Button>
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">{firstName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <section className="space-y-5">
            <Card className="workspace-hero overflow-hidden border-0 shadow-xl shadow-indigo-500/10">
              <CardContent className="relative p-6 sm:p-8">
                <div className="absolute -right-12 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-md">
                    <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-white/15 text-white"><Focus className="size-5" /></div>
                    <p className="text-sm font-semibold text-indigo-100">{t("workspace.yourFocus")}</p>
                    <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{t("workspace.makeSpace")}</h2>
                    <p className="mt-2 text-sm leading-6 text-indigo-100/80">{t("workspace.focusSub")}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur">
                    <p className="text-3xl font-extrabold text-white">{progress}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100">{t("workspace.complete")}</p>
                  </div>
                </div>
                <Progress value={progress} className="relative mt-7 h-2 bg-white/20 [&>div]:bg-white" />
                <div className="relative mt-3 flex items-center justify-between text-xs font-medium text-indigo-100"><span>{t("workspace.tasksFinished", { done, total: todayTasks.length })}</span><span>{todayTasks.length ? t("workspace.keepGoing") : t("workspace.freshStart")}</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-500">{t("workspace.today")}</p><h2 className="mt-1 text-xl font-extrabold">{t("workspace.dayFlow")}</h2></div>
                  <Button onClick={() => navigate("/life/today")} variant="ghost" size="sm" className="gap-1 text-indigo-600">{t("workspace.openFull")} <ArrowRight className="size-3.5" /></Button>
                </div>
                <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: 7 }, (_, index) => addDaysKey(today, index - 2)).map((day) => {
                    const date = new Date(`${day}T12:00:00`);
                    return <button key={day} onClick={() => setSelectedDay(day)} className={cn("min-w-[54px] rounded-2xl px-2 py-2 text-center transition", selectedDay === day ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10")}><span className="block text-[10px] font-bold uppercase">{weekdays[date.getDay()]}</span><span className="mt-1 block text-lg font-extrabold">{date.getDate()}</span></button>;
                  })}
                </div>
                <form onSubmit={submitQuickTask} className="mt-5 flex gap-2"><Input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder={t("workspace.addForDay")} className="h-11 rounded-xl border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5" /><Button size="icon" className="size-11 rounded-xl"><Plus className="size-5" /></Button></form>
                <div className="mt-4 space-y-1.5">
                  {todayTasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => toggleTask(task.id)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"><span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", task.status === "completed" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent group-hover:border-indigo-400 dark:border-slate-600")}>{task.status === "completed" && <Check className="size-3.5" />}</span><span className={cn("flex-1 text-sm font-medium", task.status === "completed" && "text-slate-400 line-through dark:text-slate-500")}>{task.title}</span>{task.dueTime && <span className="text-xs text-slate-400">{task.dueTime}</span>}</button>)}
                  {todayTasks.length === 0 && <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-white/5">{t("workspace.clearDay")}</p>}
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-5">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/[.04]"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-rose-500">{t("workspace.rhythm")}</p><h2 className="mt-1 text-lg font-extrabold">{t("workspace.smallHabits")}</h2></div><span className="flex size-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Flame className="size-5" /></span></div><div className="mt-5 flex items-end justify-between"><span className="text-3xl font-extrabold">{completedHabits}<span className="text-base text-slate-400">/{todayHabits.length}</span></span><span className="text-xs font-semibold text-slate-400">{t("workspace.habitsToday")}</span></div><Progress value={todayHabits.length ? (completedHabits / todayHabits.length) * 100 : 0} className="mt-3 h-2" /><Link to="/life/habits" className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600">{t("workspace.seeHabits")} <ChevronRight className="size-4" /></Link></CardContent></Card>
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/[.04]"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-500">{t("goals.title")}</p><h2 className="mt-1 text-lg font-extrabold">{t("workspace.building")}</h2></div><Target className="size-5 text-emerald-500" /></div><div className="mt-4 space-y-3">{activeGoals.slice(0, 3).map((goal) => <div key={goal.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{goal.title}</span><span className="text-xs text-slate-400">{t("workspace.active")}</span></div><Progress value={goal.status === "achieved" ? 100 : 62} className="mt-2 h-1.5" /></div>)}{activeGoals.length === 0 && <p className="text-sm text-slate-500">{t("workspace.setGoal")}</p>}</div><Link to="/life/goals" className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600">{t("workspace.manageGoals")} <ArrowRight className="size-3.5" /></Link></CardContent></Card>
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/[.04]"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-500">{t("workspace.comingUp")}</p><h2 className="mt-1 text-lg font-extrabold">{t("workspace.radar")}</h2></div><CalendarDays className="size-5 text-amber-500" /></div><div className="mt-4 space-y-2">{upcoming.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 dark:border-white/10"><span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-xs font-bold text-amber-600 dark:bg-amber-500/10">{event.date.slice(8)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="text-[11px] text-slate-400">{event.date}</p></div></div>)}{upcoming.length === 0 && <p className="text-sm text-slate-500">{t("workspace.noUpcoming")}</p>}</div></CardContent></Card>
            <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-lg dark:bg-white/10"><div className="flex items-center gap-2 text-xs font-bold text-indigo-200"><Sparkles className="size-3.5" /> {t("workspace.gentle")}</div><p className="mt-2 text-sm leading-6 text-slate-300">{t("workspace.reminder")}</p>{can("expense") && <div className="mt-3 flex items-center justify-between text-xs"><span>{t("workspace.monthSpending")}</span><span className="font-bold">{money(monthExpenses)}</span></div>}</div>
          </aside>
        </div>
      </main>
      <nav className="workspace-mobile-nav lg:hidden"><button onClick={() => navigate("/workspace")} className="workspace-mobile-item active"><LayoutGrid className="size-4" />{t("workspace.home")}</button><button onClick={() => navigate("/life/tasks")} className="workspace-mobile-item"><Check className="size-4" />{t("workspace.tasks")}</button><button onClick={() => navigate("/life/calendar")} className="workspace-mobile-item"><CalendarDays className="size-4" />{t("workspace.calendar")}</button><button onClick={() => navigate("/life/settings")} className="workspace-mobile-item"><Settings className="size-4" />{t("workspace.more")}</button></nav>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick }: { icon: typeof LayoutGrid; label: string; active?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white")}><Icon className="size-4" />{label}</button>;
}
