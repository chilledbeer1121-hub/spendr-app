import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCards, useExpenses, useProfile, type CreditCard } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, CreditCard as CardIcon, Pencil, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cards")({
  component: () => <AppShell><CardsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Cards — Spendr" }] }),
});

const SWATCHES = ["#9FCC2B", "#2E90FA", "#F79009", "#9E77ED", "#F63D68", "#12B76A", "#6366F1", "#0F0F0C"];
const NETWORKS = ["Visa", "Mastercard", "Amex", "RuPay", "Discover", "Other"];

function nextDate(day: number): Date {
  const t = new Date();
  const cap = Math.min(day, 28);
  let d = new Date(t.getFullYear(), t.getMonth(), cap);
  if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, cap);
  return d;
}

function CardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cards = [] } = useCards(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { data: expenses = [] } = useExpenses(user?.id, { from: new Date(2020, 0, 1) });
  const currency = profile?.currency ?? "INR";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);

  const totalsByCard = useMemo(() => {
    const out: Record<string, { outstanding: number; pending: number; lifetime: number }> = {};
    for (const c of cards) {
      const settled = c.settled_until ? parseISO(c.settled_until) : null;
      let outstanding = 0;
      let lifetime = 0;
      for (const e of expenses) {
        if (e.card_id !== c.id) continue;
        const amt = Number(e.amount);
        lifetime += amt;
        if (!settled || parseISO(e.date) > settled) outstanding += amt;
      }
      out[c.id] = { outstanding, pending: 0, lifetime };
    }
    return out;
  }, [cards, expenses]);

  const grandOutstanding = Object.values(totalsByCard).reduce((s, v) => s + v.outstanding, 0);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this card? Expenses linked to it will remain but become unlinked.")) return;
    await supabase.from("expenses").update({ card_id: null }).eq("card_id", id);
    await supabase.from("recurring_expenses").update({ card_id: null }).eq("card_id", id);
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Card removed");
    qc.invalidateQueries({ queryKey: ["cards"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const markPaid = async (c: CreditCard) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("cards").update({ settled_until: today }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(`${c.name} marked paid up to today`);
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Cards</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track card spend, billing cycles & outstanding</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="size-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edit card" : "New card"}</DialogTitle></DialogHeader>
            <CardForm
              editing={editing}
              onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["cards"] }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {cards.length > 0 && (
        <Card className="p-4 mb-4 bg-card border-border">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Total outstanding (all cards)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">{formatCurrency(grandOutstanding, currency)}</div>
          <div className="text-xs text-muted-foreground">{cards.length} card{cards.length === 1 ? "" : "s"} tracked</div>
        </Card>
      )}

      {cards.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <CardIcon className="size-6" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No cards yet. Add a card to track billing cycles & outstanding.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cards.map((c) => {
            const t = totalsByCard[c.id] ?? { outstanding: 0, lifetime: 0 };
            const nextBill = nextDate(c.billing_day);
            const nextDue = nextDate(c.due_day);
            const utilPct = c.credit_limit ? Math.min(100, (t.outstanding / c.credit_limit) * 100) : null;
            const overLimit = utilPct !== null && utilPct >= 90;
            return (
              <Card key={c.id} className="p-4 bg-card border-border overflow-hidden relative">
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: c.color }}
                />
                <div className="flex items-start gap-3">
                  <div
                    className="size-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${c.color}22`, color: c.color }}
                  >
                    <CardIcon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      {c.last4 && <span className="text-[10px] text-muted-foreground font-mono">•••• {c.last4}</span>}
                      {c.network && <span className="text-[9px] uppercase tracking-wider bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{c.network}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {c.issuer ? `${c.issuer} · ` : ""}Bill {format(nextBill, "MMM d")} · Due {format(nextDue, "MMM d")}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Outstanding</div>
                    <div className={cn("mt-0.5 font-display text-lg font-bold tabular-nums", overLimit && "text-destructive")}>
                      {formatCurrency(t.outstanding, currency)}
                    </div>
                    {c.settled_until && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Since {format(parseISO(c.settled_until), "MMM d")}</div>
                    )}
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Lifetime spent</div>
                    <div className="mt-0.5 font-display text-lg font-bold tabular-nums">{formatCurrency(t.lifetime, currency)}</div>
                    {c.credit_limit && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Limit {formatCurrency(c.credit_limit, currency)}</div>
                    )}
                  </div>
                </div>

                {utilPct !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className={cn("font-medium tabular-nums", overLimit ? "text-destructive" : "text-foreground")}>{utilPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${utilPct}%`, background: overLimit ? "hsl(var(--destructive))" : c.color }} />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => markPaid(c)} disabled={t.outstanding === 0}>
                    <CheckCircle2 className="size-3.5" /> Mark statement paid
                  </Button>
                </div>

                {overLimit && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="size-3.5" /> Approaching credit limit
                  </div>
                )}
                {c.note && <div className="mt-2 text-[11px] text-muted-foreground italic">{c.note}</div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardForm({ editing, onDone }: { editing: CreditCard | null; onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [last4, setLast4] = useState(editing?.last4 ?? "");
  const [network, setNetwork] = useState(editing?.network ?? "Visa");
  const [issuer, setIssuer] = useState(editing?.issuer ?? "");
  const [billingDay, setBillingDay] = useState(String(editing?.billing_day ?? 1));
  const [dueDay, setDueDay] = useState(String(editing?.due_day ?? 15));
  const [limit, setLimit] = useState(editing?.credit_limit ? String(editing.credit_limit) : "");
  const [color, setColor] = useState(editing?.color ?? SWATCHES[0]);
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Card name?");
    const bd = parseInt(billingDay, 10);
    const dd = parseInt(dueDay, 10);
    if (!bd || bd < 1 || bd > 28) return toast.error("Billing day 1–28");
    if (!dd || dd < 1 || dd > 28) return toast.error("Due day 1–28");
    if (last4 && !/^\d{2,4}$/.test(last4)) return toast.error("Last 4 should be digits");
    setBusy(true);
    const payload = {
      name: name.trim(),
      last4: last4.trim() || null,
      network: network || null,
      issuer: issuer.trim() || null,
      billing_day: bd,
      due_day: dd,
      credit_limit: limit ? parseFloat(limit) : null,
      color,
      note: note.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("cards").update(payload).eq("id", editing.id)
      : await supabase.from("cards").insert({ ...payload, user_id: user!.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Card updated" : "Card added");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Card name</Label>
        <Input placeholder="e.g. HDFC Regalia" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Issuer / Bank</Label>
          <Input placeholder="HDFC, ICICI…" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Last 4 digits (opt)</Label>
          <Input inputMode="numeric" maxLength={4} placeholder="1234" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Network</Label>
        <div className="flex flex-wrap gap-1.5">
          {NETWORKS.map((n) => (
            <button key={n} type="button" onClick={() => setNetwork(n)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                network === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Statement day (1–28)</Label>
          <Input type="number" min={1} max={28} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Due day (1–28)</Label>
          <Input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Credit limit (optional)</Label>
        <Input type="number" inputMode="decimal" placeholder="100000" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((s) => (
            <button key={s} type="button" onClick={() => setColor(s)}
              className={cn("size-7 rounded-full border-2 transition-all", color === s ? "border-foreground scale-110" : "border-transparent")}
              style={{ background: s }} />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Note (optional)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : editing ? "Update card" : "Save card"}</Button>
    </form>
  );
}
