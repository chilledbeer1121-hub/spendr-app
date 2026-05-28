import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRecurring, useCategories, useCards, type Recurring } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { CategoryDot } from "@/components/category-dot";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Repeat, Trash2, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/recurring")({
  component: () => <AppShell><RecurringPage /></AppShell>,
  head: () => ({ meta: [{ title: "Recurring — Spendr" }] }),
});

const PAYMENT_MODES = ["EMI", "UPI", "CARD", "NET_BANKING", "CASH"] as const;

function RecurringPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: items = [] } = useRecurring(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);

  const onDelete = async (id: string) => {
    if (!confirm("Stop this recurring plan? Past generated expenses are kept.")) return;
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recurring plan stopped");
    qc.invalidateQueries({ queryKey: ["recurring"] });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["recurring"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const monthlyTotal = items.filter((i) => i.is_active).reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Recurring (EMIs)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-logged each month between start &amp; end</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New recurring expense</DialogTitle></DialogHeader>
            <RecurringForm onDone={() => { setOpen(false); refresh(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 mb-4 bg-card border-border">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Monthly commitment</div>
        <div className="mt-1 font-display text-2xl font-bold tabular-nums">{formatCurrency(monthlyTotal)}</div>
        <div className="text-xs text-muted-foreground">{items.filter((i) => i.is_active).length} active plans</div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Repeat className="size-6" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No recurring plans yet. Add EMIs, rent, subscriptions.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border bg-card border-border">
          {items.map((r) => {
            const c = categories.find((c) => c.id === r.category_id);
            const ended = parseISO(r.end_date) < new Date();
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryDot color={c?.color ?? "#888"} icon={c?.icon ?? "tag"} />
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    {!r.is_active && <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">Paused</span>}
                    {ended && <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">Ended</span>}
                    {r.card_id && <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Card</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Day {r.day_of_month} · {format(parseISO(r.start_date), "MMM yyyy")} → {format(parseISO(r.end_date), "MMM yyyy")} · {r.payment_mode}
                  </div>
                </button>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(r.amount))}</div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(r)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit recurring expense</DialogTitle></DialogHeader>
          {editing && (
            <RecurringForm
              initial={editing}
              onDone={() => { setEditing(null); refresh(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecurringForm({ initial, onDone }: { initial?: Recurring; onDone: () => void }) {
  const { user } = useAuth();
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>(initial?.payment_mode ?? "EMI");
  const [cardId, setCardId] = useState<string | null>(initial?.card_id ?? null);
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    if (initial?.end_date) return initial.end_date;
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10);
  });
  const [day, setDay] = useState(initial ? String(initial.day_of_month) : "1");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const isEdit = !!initial;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const dom = parseInt(day, 10);
    if (!name.trim()) return toast.error("Name?");
    if (!categoryId) return toast.error("Pick a category");
    if (!amt || amt <= 0) return toast.error("Amount?");
    if (!dom || dom < 1 || dom > 28) return toast.error("Day must be 1–28");
    if (endDate < startDate) return toast.error("End date before start");
    const onCard = paymentMode === "CARD" || paymentMode === "EMI";
    setBusy(true);
    const payload = {
      name: name.trim(),
      category_id: categoryId,
      amount: amt,
      payment_mode: paymentMode,
      start_date: startDate,
      end_date: endDate,
      day_of_month: dom,
      note: note.trim() || null,
      card_id: onCard ? cardId : null,
      is_active: isActive,
    };
    let err;
    if (isEdit) {
      ({ error: err } = await supabase.from("recurring_expenses").update(payload).eq("id", initial!.id));
    } else {
      ({ error: err } = await supabase.from("recurring_expenses").insert({ user_id: user!.id, ...payload }));
    }
    if (err) { setBusy(false); return toast.error(err.message); }
    await supabase.rpc("materialize_recurring_expenses", { _user_id: user!.id });
    setBusy(false);
    toast.success(isEdit ? "Recurring plan updated" : "Recurring plan added");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input placeholder="e.g. Home loan EMI" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Monthly amount</Label>
          <Input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Day of month (1–28)</Label>
          <Input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Payment mode</Label>
        <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as typeof PAYMENT_MODES[number])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {(paymentMode === "CARD" || paymentMode === "EMI") && cards.length > 0 && (
        <div className="space-y-1.5">
          <Label>Charge to card (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCardId(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${cardId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              None
            </button>
            {cards.map((c) => (
              <button key={c.id} type="button" onClick={() => setCardId(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${cardId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name}{c.last4 ? ` ••${c.last4}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Note (optional)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {isEdit && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <div>
            <div className="text-sm font-medium">Active</div>
            <div className="text-[11px] text-muted-foreground">Pause to stop auto-generating future expenses</div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : isEdit ? "Save changes" : "Save & generate"}
      </Button>
    </form>
  );
}
