import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMemoryEntries, type MemoryEntry } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, BookHeart, Trash2, Check } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/memory")({
  component: () => <AppShell><MemoryPage /></AppShell>,
  head: () => ({ meta: [{ title: "Money Memory — Spendr" }] }),
});

function MemoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: entries = [] } = useMemoryEntries(user?.id);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"OWED_TO_ME" | "I_OWE" | "SETTLED">("OWED_TO_ME");

  const groups = useMemo(() => {
    const owedToMe = entries.filter((e) => e.direction === "OWED_TO_ME" && !e.settled_at);
    const iOwe = entries.filter((e) => e.direction === "I_OWE" && !e.settled_at);
    const settled = entries.filter((e) => e.settled_at);
    const sumA = owedToMe.reduce((s, e) => s + Number(e.amount), 0);
    const sumB = iOwe.reduce((s, e) => s + Number(e.amount), 0);
    return { owedToMe, iOwe, settled, sumA, sumB };
  }, [entries]);

  const settle = async (id: string) => {
    await supabase.from("memory_entries").update({ settled_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["memory"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("memory_entries").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["memory"] });
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Money Memory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Who owes you, who you owe</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New memory entry</DialogTitle></DialogHeader>
            <MemoryForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["memory"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3 bg-card border-border">
          <div className="text-[10px] uppercase tracking-wide text-success font-medium">Owed to me</div>
          <div className="font-display text-lg font-bold tabular-nums mt-0.5 text-success">{formatCurrency(groups.sumA)}</div>
          <div className="text-[10px] text-muted-foreground">{groups.owedToMe.length} entries</div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="text-[10px] uppercase tracking-wide text-destructive font-medium">I owe</div>
          <div className="font-display text-lg font-bold tabular-nums mt-0.5 text-destructive">{formatCurrency(groups.sumB)}</div>
          <div className="text-[10px] text-muted-foreground">{groups.iOwe.length} entries</div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="OWED_TO_ME">Owed to me</TabsTrigger>
          <TabsTrigger value="I_OWE">I owe</TabsTrigger>
          <TabsTrigger value="SETTLED">Settled</TabsTrigger>
        </TabsList>
        <TabsContent value="OWED_TO_ME"><EntryList items={groups.owedToMe} onSettle={settle} onDelete={remove} empty="Nobody owes you anything." /></TabsContent>
        <TabsContent value="I_OWE"><EntryList items={groups.iOwe} onSettle={settle} onDelete={remove} empty="You don't owe anyone." /></TabsContent>
        <TabsContent value="SETTLED"><EntryList items={groups.settled} onSettle={() => {}} onDelete={remove} empty="No settled entries yet." settled /></TabsContent>
      </Tabs>
    </div>
  );
}

function EntryList({ items, onSettle, onDelete, empty, settled }: {
  items: MemoryEntry[]; onSettle: (id: string) => void; onDelete: (id: string) => void; empty: string; settled?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center bg-card border-border mt-3">
        <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><BookHeart className="size-6" /></div>
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-border bg-card border-border mt-3">
      {items.map((e) => {
        const daysLeft = e.deadline ? differenceInCalendarDays(parseISO(e.deadline), new Date()) : null;
        const overdue = daysLeft !== null && daysLeft < 0;
        return (
          <div key={e.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm truncate">{e.person_name}</div>
                  {!settled && e.deadline && (
                    <span className={cn("text-[9px] uppercase tracking-wider rounded-full px-1.5 py-0.5",
                      overdue ? "bg-destructive/15 text-destructive" : daysLeft! <= 7 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                    )}>
                      {overdue ? `${Math.abs(daysLeft!)}d overdue` : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Logged {format(parseISO(e.date), "MMM d")}{e.deadline ? ` · due ${format(parseISO(e.deadline), "MMM d")}` : ""}
                </div>
                {e.note && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{e.note}</div>}
              </div>
              <div className={cn("text-sm font-semibold tabular-nums", e.direction === "OWED_TO_ME" ? "text-success" : "text-destructive")}>
                {e.direction === "OWED_TO_ME" ? "+" : "−"}{formatCurrency(Number(e.amount))}
              </div>
            </div>
            {!settled && (
              <div className="flex justify-end gap-1 mt-1">
                <Button variant="ghost" size="sm" onClick={() => onSettle(e.id)} className="h-7 text-xs">
                  <Check className="size-3" /> Settle
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)} className="size-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
            {settled && (
              <div className="flex justify-end mt-1">
                <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)} className="size-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function MemoryForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [direction, setDirection] = useState<"OWED_TO_ME" | "I_OWE">("OWED_TO_ME");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim()) return toast.error("Person?");
    if (!amt || amt <= 0) return toast.error("Amount?");
    setBusy(true);
    const { error } = await supabase.from("memory_entries").insert({
      user_id: user!.id, direction, person_name: name.trim(), amount: amt, date,
      deadline: deadline || null, note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDirection("OWED_TO_ME")}
          className={cn("rounded-lg border p-3 text-sm font-medium transition-colors",
            direction === "OWED_TO_ME" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground")}>
          They owe me
        </button>
        <button type="button" onClick={() => setDirection("I_OWE")}
          className={cn("rounded-lg border p-3 text-sm font-medium transition-colors",
            direction === "I_OWE" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground")}>
          I owe them
        </button>
      </div>
      <div className="space-y-1.5">
        <Label>Person name</Label>
        <Input placeholder="e.g. Rohan" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Deadline</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea rows={2} placeholder="e.g. paid for clothes, recover by 30 June" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  );
}
