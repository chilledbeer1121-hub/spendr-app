import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useProfile, useThisMonthExpenses } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, currencySymbol } from "@/lib/format";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { TrendingUp, PiggyBank, Wallet, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investing")({
  component: () => <AppShell><InvestingPage /></AppShell>,
  head: () => ({ meta: [{ title: "Investing — Spendr" }] }),
});

type Investment = {
  id: string;
  amount: number;
  broker: string;
  date: string;
  note: string | null;
};

function useInvestments(userId: string | undefined) {
  return useQuery({
    queryKey: ["investments", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Investment[]> => {
      const { data, error } = await supabase
        .from("investments" as any)
        .select("id, amount, broker, date, note")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Investment[];
    },
  });
}

function InvestingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: investments = [] } = useInvestments(user?.id);
  const { data: monthExpenses = [] } = useThisMonthExpenses(user?.id);
  const currency = profile?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const [amount, setAmount] = useState("");
  const [broker, setBroker] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(new Date()).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const monthInv = investments.filter((i) => i.date >= monthStart && i.date <= monthEnd);
    const investedThisMonth = monthInv.reduce((s, i) => s + Number(i.amount), 0);
    const spentThisMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const salary = Number(profile?.monthly_salary ?? 0);
    const savedThisMonth = salary - spentThisMonth;
    const netSaved = savedThisMonth - investedThisMonth;
    const totalInvested = investments.reduce((s, i) => s + Number(i.amount), 0);
    return { investedThisMonth, spentThisMonth, savedThisMonth, netSaved, totalInvested };
  }, [investments, monthExpenses, profile, monthStart, monthEnd]);

  const brokerSuggestions = useMemo(() => {
    const map = new Map<string, number>();
    investments.forEach((i) => map.set(i.broker, (map.get(i.broker) ?? 0) + Number(i.amount)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [investments]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!broker.trim()) return toast.error("Add the broker name");
    setBusy(true);
    const { error } = await supabase.from("investments" as any).insert({
      user_id: user!.id,
      amount: amt,
      broker: broker.trim(),
      date,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${symbol}${amt.toLocaleString("en-IN")} invested in ${broker.trim()}`);
    setAmount(""); setNote("");
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("investments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">Investing</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tracked separately — investments don't count as expenses anywhere else.
        </p>
      </div>

      {/* This month picture */}
      <Card className="p-5 bg-gradient-to-br from-primary/15 via-card to-card border-primary/30 mb-4">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <TrendingUp className="size-4" /> This month
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <PiggyBank className="size-3" /> Saved
            </div>
            <div className={cn("mt-1 font-display text-lg font-bold tabular-nums", stats.savedThisMonth >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.savedThisMonth, currency)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="size-3" /> Invested
            </div>
            <div className="mt-1 font-display text-lg font-bold tabular-nums">{formatCurrency(stats.investedThisMonth, currency)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <Wallet className="size-3" /> Net saved
            </div>
            <div className={cn("mt-1 font-display text-lg font-bold tabular-nums", stats.netSaved >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.netSaved, currency)}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-3">
          Salary {formatCurrency(Number(profile?.monthly_salary ?? 0), currency)} − Spent {formatCurrency(stats.spentThisMonth, currency)} = Saved · then minus what you invested.
        </div>
      </Card>

      {/* Add form */}
      <Card className="p-4 bg-card border-border mb-4">
        <form onSubmit={onAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">{symbol}</span>
                <Input id="amount" type="number" inputMode="decimal" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 h-12 text-lg font-display font-bold tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broker">Broker</Label>
              <Input id="broker" placeholder="e.g. Zerodha, Groww" value={broker} onChange={(e) => setBroker(e.target.value)} list="broker-suggestions" />
              <datalist id="broker-suggestions">
                {brokerSuggestions.map(([b]) => <option key={b} value={b} />)}
              </datalist>
            </div>
          </div>
          {brokerSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {brokerSuggestions.slice(0, 6).map(([b]) => (
                <button key={b} type="button" onClick={() => setBroker(b)}
                  className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    broker === b ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {b}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" placeholder="e.g. NIFTY 50 SIP" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            <Plus className="size-4" /> {busy ? "Adding…" : "Add investment"}
          </Button>
        </form>
      </Card>

      {/* By broker */}
      {brokerSuggestions.length > 0 && (
        <Card className="p-4 bg-card border-border mb-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">By broker · lifetime</div>
          <div className="space-y-2">
            {brokerSuggestions.map(([b, total]) => {
              const pct = stats.totalInvested > 0 ? (total / stats.totalInvested) * 100 : 0;
              return (
                <div key={b}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{b}</span>
                    <span className="tabular-nums">{formatCurrency(total, currency)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-sm font-semibold">
              <span>Total invested</span>
              <span className="tabular-nums">{formatCurrency(stats.totalInvested, currency)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* History */}
      <Card className="bg-card border-border">
        <div className="px-4 py-3 border-b border-border text-xs uppercase tracking-wide text-muted-foreground font-medium">
          All investments
        </div>
        {investments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><TrendingUp className="size-6" /></div>
            <p className="mt-3 text-sm text-muted-foreground">No investments logged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {investments.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{i.broker}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(parseISO(i.date), "d MMM yyyy")}{i.note ? ` · ${i.note}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(i.amount), currency)}</div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(i.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
