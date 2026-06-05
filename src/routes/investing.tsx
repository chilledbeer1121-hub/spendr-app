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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, currencySymbol } from "@/lib/format";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { TrendingUp, PiggyBank, Wallet, Trash2, Plus, Building2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/investing")({
  component: () => <AppShell><InvestingPage /></AppShell>,
  head: () => ({ meta: [{ title: "Investing — Spendr" }] }),
});

type Investment = {
  id: string;
  amount: number;
  broker_id: string | null;
  broker: string; // legacy fallback
  date: string;
  note: string | null;
};
type Broker = { id: string; name: string };

const BROKER_COLORS = ["#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#0EA5E9"];

function useInvestments(userId: string | undefined) {
  return useQuery({
    queryKey: ["investments", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Investment[]> => {
      const { data, error } = await supabase
        .from("investments" as any)
        .select("id, amount, broker_id, broker, date, note")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Investment[];
    },
  });
}

function useBrokers(userId: string | undefined) {
  return useQuery({
    queryKey: ["brokers", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Broker[]> => {
      const { data, error } = await supabase
        .from("brokers" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Broker[];
    },
  });
}

function InvestingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: brokers = [] } = useBrokers(user?.id);
  const { data: investments = [] } = useInvestments(user?.id);
  const { data: monthExpenses = [] } = useThisMonthExpenses(user?.id);
  const currency = profile?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const brokerById = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);
  const brokerNameOf = (i: Investment) =>
    (i.broker_id && brokerById.get(i.broker_id)?.name) || i.broker || "—";

  const [amount, setAmount] = useState("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Add broker dialog
  const [newBrokerOpen, setNewBrokerOpen] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState("");

  // Manage brokers dialog
  const [manageOpen, setManageOpen] = useState(false);

  // Broker drilldown
  const [drillBroker, setDrillBroker] = useState<{ id: string | null; name: string } | null>(null);

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

  // Per-broker aggregate (lifetime, this-month, count, last date)
  const byBroker = useMemo(() => {
    const map = new Map<string, { key: string; name: string; brokerId: string | null; total: number; thisMonth: number; count: number; last: string }>();
    investments.forEach((i, idx) => {
      const name = brokerNameOf(i);
      const key = i.broker_id ?? `legacy:${name}`;
      const prev = map.get(key);
      const amt = Number(i.amount);
      if (prev) {
        prev.total += amt;
        prev.count += 1;
        if (i.date >= monthStart && i.date <= monthEnd) prev.thisMonth += amt;
        if (i.date > prev.last) prev.last = i.date;
      } else {
        map.set(key, {
          key,
          name,
          brokerId: i.broker_id,
          total: amt,
          thisMonth: i.date >= monthStart && i.date <= monthEnd ? amt : 0,
          count: 1,
          last: i.date,
        });
      }
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [investments, brokerById, monthStart, monthEnd]);

  // Monthly cumulative chart per broker (top 6)
  const chartData = useMemo(() => {
    if (investments.length === 0) return { rows: [] as any[], brokers: [] as { key: string; name: string; color: string }[] };
    const top = byBroker.slice(0, 6).map((b, idx) => ({ key: b.key, name: b.name, color: BROKER_COLORS[idx % BROKER_COLORS.length] }));
    const monthsSet = new Set<string>();
    investments.forEach((i) => monthsSet.add(i.date.slice(0, 7)));
    const months = [...monthsSet].sort();
    const running: Record<string, number> = {};
    top.forEach((b) => (running[b.key] = 0));
    const rows = months.map((m) => {
      investments
        .filter((i) => i.date.slice(0, 7) === m)
        .forEach((i) => {
          const k = i.broker_id ?? `legacy:${brokerNameOf(i)}`;
          if (k in running) running[k] += Number(i.amount);
        });
      const row: any = { month: format(parseISO(m + "-01"), "MMM yy") };
      top.forEach((b) => (row[b.key] = Math.round(running[b.key])));
      return row;
    });
    return { rows, brokers: top };
  }, [investments, byBroker]);

  // Drilldown data
  const drillData = useMemo(() => {
    if (!drillBroker) return null;
    const rows = investments.filter((i) =>
      drillBroker.id ? i.broker_id === drillBroker.id : brokerNameOf(i) === drillBroker.name
    );
    const total = rows.reduce((s, i) => s + Number(i.amount), 0);
    const monthly = new Map<string, number>();
    rows.forEach((i) => {
      const m = i.date.slice(0, 7);
      monthly.set(m, (monthly.get(m) ?? 0) + Number(i.amount));
    });
    const monthRows = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({ month: format(parseISO(m + "-01"), "MMM yyyy"), amount: Math.round(v) }));
    return { rows, total, monthRows };
  }, [drillBroker, investments, brokerById]);

  const onAddBroker = async () => {
    const name = newBrokerName.trim();
    if (!name) return toast.error("Enter a broker name");
    const { data, error } = await supabase
      .from("brokers" as any)
      .insert({ user_id: user!.id, name })
      .select("id, name")
      .single();
    if (error) return toast.error(error.message);
    toast.success(`Added ${name}`);
    setNewBrokerName("");
    setNewBrokerOpen(false);
    qc.invalidateQueries({ queryKey: ["brokers"] });
    if (data) setBrokerId((data as any).id as string);
  };

  const onDeleteBroker = async (id: string) => {
    const used = investments.some((i) => i.broker_id === id);
    if (used && !confirm("This broker has investments linked. Delete anyway? The investments will keep their broker name.")) return;
    const { error } = await supabase.from("brokers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["brokers"] });
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!brokerId) return toast.error("Pick a broker");
    const broker = brokerById.get(brokerId);
    if (!broker) return toast.error("Broker not found");
    setBusy(true);
    const { error } = await supabase.from("investments" as any).insert({
      user_id: user!.id,
      amount: amt,
      broker_id: brokerId,
      broker: broker.name, // keep name copy for legacy column
      date,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${symbol}${amt.toLocaleString("en-IN")} invested in ${broker.name}`);
    setAmount(""); setNote("");
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("investments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const accent = "text-primary";
  const warn = "text-destructive";

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Investing</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tracked separately — investments don't count as expenses anywhere else.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
          <Building2 className="size-4" /> Brokers
        </Button>
      </div>

      {/* This month picture */}
      <Card className="p-5 bg-gradient-to-br from-primary/15 via-card to-card border-primary/30 mb-4">
        <div className={cn("flex items-center gap-2 text-sm font-medium", accent)}>
          <TrendingUp className="size-4" /> This month
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Stat label="Saved" icon={<PiggyBank className="size-3" />} value={stats.savedThisMonth} currency={currency} accent={stats.savedThisMonth >= 0 ? accent : warn} />
          <Stat label="Invested" icon={<TrendingUp className="size-3" />} value={stats.investedThisMonth} currency={currency} accent="text-foreground" />
          <Stat label="Net saved" icon={<Wallet className="size-3" />} value={stats.netSaved} currency={currency} accent={stats.netSaved >= 0 ? accent : warn} />
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
              <Label>Broker</Label>
              <div className="flex gap-2">
                <Select value={brokerId} onValueChange={setBrokerId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={brokers.length === 0 ? "No brokers yet" : "Pick a broker"} />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={newBrokerOpen} onOpenChange={setNewBrokerOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="icon"><Plus className="size-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a broker</DialogTitle>
                      <DialogDescription>e.g. Zerodha, Groww, Upstox, INDmoney</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="Broker name"
                        value={newBrokerName}
                        onChange={(e) => setNewBrokerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBroker(); } }}
                        autoFocus
                      />
                      <Button onClick={onAddBroker} className="w-full">Add</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
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
          <Button type="submit" disabled={busy || brokers.length === 0} className="w-full">
            <Plus className="size-4" /> {busy ? "Adding…" : "Add investment"}
          </Button>
          {brokers.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center">Add a broker first to log investments.</p>
          )}
        </form>
      </Card>

      {/* Per-broker cards */}
      {byBroker.length > 0 && (
        <Card className="p-4 bg-card border-border mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">By broker</div>
            <div className="text-[11px] text-muted-foreground">Tap a row for details</div>
          </div>
          <div className="space-y-1.5">
            {byBroker.map((b, idx) => {
              const pct = stats.totalInvested > 0 ? (b.total / stats.totalInvested) * 100 : 0;
              const color = BROKER_COLORS[idx % BROKER_COLORS.length];
              return (
                <button
                  key={b.key}
                  onClick={() => setDrillBroker({ id: b.brokerId, name: b.name })}
                  className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="font-medium text-sm truncate">{b.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">· {b.count} entr{b.count === 1 ? "y" : "ies"}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatCurrency(b.total, currency)}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {b.thisMonth > 0 ? `+${formatCurrency(b.thisMonth, currency)} this mo` : `last ${format(parseISO(b.last), "d MMM")}`}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </button>
              );
            })}
            <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-sm font-semibold px-3">
              <span>Total invested</span>
              <span className="tabular-nums">{formatCurrency(stats.totalInvested, currency)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Cumulative chart */}
      {chartData.rows.length > 1 && (
        <Card className="p-4 bg-card border-border mb-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Growth over time</div>
          <div className="text-[11px] text-muted-foreground mb-3">Cumulative invested per broker, month by month</div>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbol}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} width={48} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, n: any) => [formatCurrency(Number(v), currency), chartData.brokers.find((b) => b.key === n)?.name ?? n]}
                />
                {chartData.brokers.map((b) => (
                  <Line key={b.key} type="monotone" dataKey={b.key} stroke={b.color} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {chartData.brokers.map((b) => (
              <div key={b.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: b.color }} />
                {b.name}
              </div>
            ))}
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
                  <div className="font-medium text-sm truncate">{brokerNameOf(i)}</div>
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

      {/* Manage brokers dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your brokers</DialogTitle>
            <DialogDescription>Add brokers so they show up in the dropdown.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="New broker name"
                value={newBrokerName}
                onChange={(e) => setNewBrokerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBroker(); } }}
              />
              <Button onClick={onAddBroker}><Plus className="size-4" /> Add</Button>
            </div>
            {brokers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No brokers yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {brokers.map((b) => {
                  const count = investments.filter((i) => i.broker_id === b.id).length;
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{b.name}</div>
                        <div className="text-[11px] text-muted-foreground">{count} investment{count === 1 ? "" : "s"}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteBroker(b.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Broker drilldown */}
      <Dialog open={!!drillBroker} onOpenChange={(o) => !o && setDrillBroker(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{drillBroker?.name}</DialogTitle>
            <DialogDescription>
              {drillData ? `${formatCurrency(drillData.total, currency)} across ${drillData.rows.length} investment${drillData.rows.length === 1 ? "" : "s"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {drillData && drillData.monthRows.length > 0 && (
            <div className="h-40 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={drillData.monthRows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbol}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} width={44} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [formatCurrency(Number(v), currency), "Invested"]}
                  />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {drillData && (
            <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {drillData.rows.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums">{formatCurrency(Number(i.amount), currency)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(parseISO(i.date), "d MMM yyyy")}{i.note ? ` · ${i.note}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, icon, value, currency, accent }: { label: string; icon: React.ReactNode; value: number; currency: string; accent: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={cn("mt-1 font-display text-lg font-bold tabular-nums", accent)}>{formatCurrency(value, currency)}</div>
    </div>
  );
}
