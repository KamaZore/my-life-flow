import { FadeIn, StatCard } from "@/components/systems/Shared";
import { MoneyInput } from "@/components/systems/MoneyInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayKey } from "@/lib/date-utils";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  deleteSalonAppointment,
  saveSalonAppointment,
  useSalon,
} from "@/lib/store";
import type { SalonAppointment } from "@/lib/types";
import { CalendarDays, Check, Clock, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const STATUSES = ["booked", "done", "cancelled", "no_show"] as const;

const emptyForm = {
  customerId: "none",
  customerName: "",
  phone: "",
  serviceId: "",
  staffId: "",
  date: todayKey(),
  time: "09:00",
  price: "",
  note: "",
};

export default function SalonAppointments() {
  const { t } = useI18n();
  const salon = useSalon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalonAppointment | null>(null);
  const [form, setForm] = useState(emptyForm);

  const today = todayKey();

  const upcoming = useMemo(
    () =>
      [...salon.appointments]
        .filter((a) => a.date >= today && a.status === "booked")
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [salon.appointments, today],
  );
  const past = useMemo(
    () =>
      [...salon.appointments]
        .filter((a) => a.date < today || a.status !== "booked")
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 40),
    [salon.appointments, today],
  );

  const custLabel = (a: SalonAppointment) =>
    a.customerName ||
    salon.customers.find((c) => c.id === a.customerId)?.name ||
    t("salon.walkIn");
  const svcName = (id: string) => salon.services.find((s) => s.id === id)?.name ?? "—";
  const staffName = (id?: string) => salon.staff.find((s) => s.id === id)?.name ?? "—";

  const statusChip = (a: SalonAppointment) => {
    const map = {
      booked: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
      done: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      cancelled: "bg-muted text-muted-foreground",
      no_show: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    } as const;
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[a.status]}`}>
        {t(a.status === "no_show" ? "salon.noShow" : `salon.${a.status}`)}
      </span>
    );
  };

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, serviceId: salon.services[0]?.id ?? "", price: salon.services[0] ? String(salon.services[0].price) : "" });
    setOpen(true);
  }

  function openEdit(a: SalonAppointment) {
    setEditing(a);
    setForm({
      customerId: a.customerId ?? "none",
      customerName: a.customerName ?? "",
      phone: a.phone ?? "",
      serviceId: a.serviceId,
      staffId: a.staffId ?? "",
      date: a.date,
      time: a.time,
      price: String(a.price),
      note: a.note ?? "",
    });
    setOpen(true);
  }

  function save() {
    if (!form.serviceId) return;
    if (form.customerId === "none" && !form.customerName.trim()) return;
    saveSalonAppointment({
      id: editing?.id,
      customerId: form.customerId === "none" ? undefined : form.customerId,
      customerName: form.customerId === "none" ? form.customerName.trim() : undefined,
      phone: form.customerId === "none" ? form.phone.trim() || undefined : undefined,
      serviceId: form.serviceId,
      staffId: form.staffId || undefined,
      date: form.date,
      time: form.time,
      status: editing?.status ?? "booked",
      price: Math.max(0, Number(form.price) || 0),
      note: form.note.trim() || undefined,
    });
    toast.success(t("salon.apptSaved"));
    setOpen(false);
  }

  function setStatus(a: SalonAppointment, status: SalonAppointment["status"]) {
    saveSalonAppointment({ ...a, status });
    if (status === "done") toast.success(`${t("salon.done")} · ${custLabel(a)}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.salon.appointments")}</h1>
          <p className="text-sm text-muted-foreground">{t("salon.apptSub")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <Plus className="size-4" />
          {t("salon.newBooking")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("salon.booked")} value={String(upcoming.length)} icon={CalendarDays} tone="text-sky-600 dark:text-sky-400" tint="bg-sky-500/12" />
        <StatCard label={t("salon.todayAppointments")} value={String(salon.appointments.filter((a) => a.date === today && a.status === "booked").length)} icon={Clock} tone="text-rose-600 dark:text-rose-400" tint="bg-rose-500/12" />
        <StatCard label={t("salon.doneCount")} value={String(salon.appointments.filter((a) => a.status === "done").length)} icon={Check} tone="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-500/12" className="col-span-2 sm:col-span-1" />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("salon.upcoming")}</h2>
        {upcoming.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            {t("salon.noUpcoming")}
          </p>
        )}
        {upcoming.map((a, i) => (
          <FadeIn key={a.id} delay={i * 0.03}>
            <div className="card-soft flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
              <div className="flex w-24 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{a.date.slice(5)}</span>
                <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
                  <Clock className="size-3 text-muted-foreground" />
                  {a.time}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold">{custLabel(a)}</p>
                  {statusChip(a)}
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  {svcName(a.serviceId)} · {staffName(a.staffId)}
                  {a.phone && (
                    <>
                      {" · "}
                      <Phone className="inline size-3" />
                      {a.phone}
                    </>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums">{money(a.price)}</p>
              <Button size="sm" className="h-8 shrink-0 gap-1 rounded-lg text-xs" onClick={() => setStatus(a, "done")}>
                <Check className="size-3.5" />
                {t("salon.done")}
              </Button>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" onClick={() => openEdit(a)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg text-destructive" onClick={() => { deleteSalonAppointment(a.id); toast.success(t("salon.apptDeleted")); }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </FadeIn>
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("salon.history")}</h2>
          {past.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 px-3.5 py-2.5">
              <span className="w-24 shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                {a.date} {a.time}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium">{custLabel(a)}</p>
                  {statusChip(a)}
                </div>
                <p className="truncate text-xs text-muted-foreground">{svcName(a.serviceId)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{money(a.price)}</p>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" onClick={() => openEdit(a)}>
                <Pencil className="size-3.5" />
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Add/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("salon.editBooking") : t("salon.newBooking")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("salon.customer")}</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("salon.newWalkIn")}</SelectItem>
                  {salon.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.customerId === "none" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-cname">{t("biz.name")}</Label>
                  <Input id="appt-cname" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="h-10 rounded-xl" placeholder={t("salon.walkIn")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appt-cphone">{t("salon.phone")}</Label>
                  <Input id="appt-cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-xl" inputMode="tel" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("salon.service")}</Label>
              <Select
                value={form.serviceId}
                onValueChange={(v) => {
                  const svc = salon.services.find((s) => s.id === v);
                  setForm({ ...form, serviceId: v, price: svc ? String(svc.price) : form.price });
                }}
              >
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {salon.services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {money(s.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("salon.staffMember")}</Label>
              <Select value={form.staffId || "none"} onValueChange={(v) => setForm({ ...form, staffId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("salon.anyStaff")}</SelectItem>
                  {salon.staff.filter((m) => m.active !== false).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="appt-date">{t("exp.dueDate")}</Label>
                <Input id="appt-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-time">{t("salon.time")}</Label>
                <Input id="appt-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-10 rounded-xl" />
              </div>
            </div>
            <MoneyInput
              label={t("biz.total")}
              valueUsd={form.price === "" ? null : Number(form.price)}
              onChangeUsd={(v) => setForm({ ...form, price: v === null ? "" : String(v) })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="appt-note">{t("exp.note")}</Label>
              <Input id="appt-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-10 rounded-xl" />
            </div>
            {editing && editing.status !== "booked" && (
              <div className="space-y-1.5">
                <Label>{t("salon.status")}</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => saveSalonAppointment({ ...editing, status: st })}
                      className={`rounded-xl border px-1 py-2 text-[10px] font-semibold transition-colors ${
                        editing.status === st
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t(st === "no_show" ? "salon.noShow" : `salon.${st}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">{t("common.cancel")}</Button>
            <Button onClick={save} disabled={!(form.serviceId && (form.customerId !== "none" || form.customerName.trim()))} className="rounded-xl">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* keep X import used for potential dismiss */}
      <span className="hidden"><X className="size-3" /></span>
    </div>
  );
}
