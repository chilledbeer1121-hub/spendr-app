import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useExpenses, useCategories, useCards } from "@/lib/expense-queries";
import { useSpendView, payableDateFor, useIncludeRecurring } from "@/lib/payable";
import { SpendViewToggle } from "@/components/spend-view-toggle";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, eachDayOfInterval, format, parseISO, isSameDay, subMonths, addMonths, isToday,
} from "date-fns";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { TrendingDown, TrendingUp, Target, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: () => <AppShell><ProgressPage /></AppShell>,
  head: () => ({ meta: [{ title: "Progress — Spendr" }] }),
});

type Period = "week" | "month" | "quarter" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
];

function rangeFor(period: Period, anchor: Date): { from: Date; to: Date } {
  switch (period) {
    case "week": return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
    case "month": return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    case "quarter": return { from: startOfQuarter(anchor), to: endOfQuarter(anchor) };
    case "year": return { from: startOfYear(anchor), to: endOfYear(anchor) };
  }
}

function ProgressPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const [period, setPeriod] = useState<Period>("month");
  const [view] = useSpendView();
  const [includeRec] = useIncludeRecurring();

  // Wide pull so payable-mode card bills bucket correctly
  const { data: rawExpenses = [] } = useExpenses(user?.id, {
    from: startOfMonth(subMonths(new Date(), 6)),
    to: endOfMonth(addMonths(new Date(), 2)),
  });

  const dailyBudget = profile?.daily_budget ?? 0;
  const currency = profile?.currency ?? "INR";
  const { from, to } = useMemo(() => rangeFor(period, new Date()), [period]);

  // Discretionary = effective type is not NEED and not EMI.
  // Per-expense `type_override` wins over the category's default type.
  const catTypeById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.type));
    return m;
  }, [categories]);

  const catById = useMemo(() => {
    const m = new Map<string, typeof categories[number]>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const isDiscretionary = (e: typeof rawExpenses[number]) => {
    // Explicitly drop EMI by payment_mode as well — Progress is for daily spend only.
    if (e.payment_mode === "EMI") return false;
    if (!includeRec && e.recurring_id) return false;
    const t = e.type_override ?? catTypeById.get(e.category_id);
    return t !== "NEED" && t !== "EMI";
  };


  // Build per-day buckets (only discretionary)
  const days = useMemo(() => eachDayOfInterval({ start: from, end: to }), [from, to]);

  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    const items = new Map<string, typeof rawExpenses>();
    days.forEach((d) => {
      const k = format(d, "yyyy-MM-dd");
      map.set(k, 0);
      items.set(k, []);
    });
    for (const e of rawExpenses) {
      if (!isDiscretionary(e)) continue;
      const dateStr = view === "payable" ? payableDateFor(e, cards) : e.date;
      if (map.has(dateStr)) {
        map.set(dateStr, (map.get(dateStr) ?? 0) + Number(e.amount));
        items.get(dateStr)!.push(e);
      }
    }
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const spent = map.get(key) ?? 0;
      const over = dailyBudget > 0 && spent > dailyBudget;
      const diff = spent - dailyBudget;
      return {
        date: d,
        key,
        spent,
        over,
        diff,
        future: d > new Date() && !isSameDay(d, new Date()),
        expenses: items.get(key) ?? [],
      };
    });
  }, [days, rawExpenses, catTypeById, view, cards, dailyBudget]);

  const summary = useMemo(() => {
    const past = perDay.filter((d) => !d.future);
    const expensive = past.filter((d) => d.over).length;
    const savings = past.filter((d) => !d.over && dailyBudget > 0).length;
    const totalSpent = past.reduce((s, d) => s + d.spent, 0);
    const totalBudget = dailyBudget * past.length;
    const net = totalBudget - totalSpent;
    return { expensive, savings, totalSpent, totalBudget, net, dayCount: past.length };
  }, [perDay, dailyBudget]);

  // Chart: only show past days so the line/area is continuous and visible.
  const chartData = useMemo(() => {
    return perDay
      .filter((d) => !d.future)
      .map((d) => ({
        label: format(d.date, "MMM d"),
        spent: Math.round(d.spent),
        budget: dailyBudget,
      }));
  }, [perDay, dailyBudget]);

  const [openDay, setOpenDay] = useState<(typeof perDay)[number] | null>(null);


  if (!profile) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (dailyBudget === 0) return <NoBudgetState />;

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Daily discretionary tracker</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Progress</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SpendViewToggle />
          <div role="tablist" className="inline-flex rounded-full bg-muted p-0.5 text-xs">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors",
                  period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Target className="size-4" />}
          label="Daily limit"
          value={formatCurrency(dailyBudget, currency)}
          sub={`${formatCurrency(dailyBudget * 30, currency)} / mo`}
        />
        <StatCard
          icon={<AlertCircle className="size-4" />}
          label="Expensive days"
          value={String(summary.expensive)}
          sub={`of ${summary.dayCount} so far`}
          tone="destructive"
        />
        <StatCard
          icon={<TrendingDown className="size-4" />}
          label="Savings days"
          value={String(summary.savings)}
          sub={`under budget`}
          tone="success"
        />
        <StatCard
          icon={summary.net >= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
          label={summary.net >= 0 ? "Net saved" : "Net over"}
          value={formatCurrency(Math.abs(summary.net), currency)}
          sub={`vs ${formatCurrency(summary.totalBudget, currency)} budget`}
          tone={summary.net >= 0 ? "success" : "destructive"}
        />
      </div>

      {/* Line chart */}
      <Card className="p-4 md:p-5 bg-card border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Daily trend</h2>
          <span className="text-[11px] text-muted-foreground">
            {format(from, "MMM d")} → {format(to, "MMM d, yyyy")}
          </span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="spentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatCurrency(Number(v ?? 0), currency)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={dailyBudget} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "Budget", fontSize: 10, fill: "hsl(var(--primary))" }} />
              <Area type="monotone" dataKey="spent" name="Spent" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#spentFill)" dot={{ r: 3, fill: "hsl(var(--destructive))" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Day-by-day progress bars */}
      <Card className="p-4 md:p-5 bg-card border-border">
        <h2 className="font-display text-lg font-semibold mb-3">Day-by-day</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Progress vs ₹{dailyBudget.toFixed(0)}</TableHead>
                <TableHead className="text-right w-28">Spent</TableHead>
                <TableHead className="text-right w-28">±</TableHead>
                <TableHead className="text-right w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perDay.slice().reverse().map((d) => {
                const pct = dailyBudget > 0 ? Math.min(200, (d.spent / dailyBudget) * 100) : 0;
                const today = isToday(d.date);
                return (
                  <TableRow
                    key={d.key}
                    onClick={() => !d.future && d.expenses.length > 0 && setOpenDay(d)}
                    className={cn(
                      today ? "bg-primary/5" : "",
                      !d.future && d.expenses.length > 0 && "cursor-pointer hover:bg-muted/50",
                    )}
                  >
                    <TableCell className="font-medium text-xs">
                      {format(d.date, "EEE, MMM d")}
                      {today && <span className="ml-1.5 text-[10px] text-primary">• today</span>}
                    </TableCell>
                    <TableCell>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted relative">
                        <div
                          className={cn(
                            "h-full transition-all",
                            d.future ? "bg-muted-foreground/20" :
                            d.over ? "bg-destructive" :
                            d.spent === 0 ? "bg-success/40" : "bg-success",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                        {pct > 100 && (
                          <div className="absolute inset-y-0 right-0 w-1 bg-destructive-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {d.future ? "—" : formatCurrency(d.spent, currency)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right tabular-nums text-xs font-medium",
                      d.future ? "text-muted-foreground" :
                      d.over ? "text-destructive" : "text-success",
                    )}>
                      {d.future ? "—" : (d.diff > 0 ? `+${formatCurrency(d.diff, currency)}` : formatCurrency(-d.diff, currency))}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.future ? (
                        <span className="text-[10px] text-muted-foreground">upcoming</span>
                      ) : d.over ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium">Expensive</span>
                      ) : d.spent === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">No spend</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-medium">Savings</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {openDay ? format(openDay.date, "EEEE, MMM d") : ""}
            </DialogTitle>
            <DialogDescription>
              {openDay
                ? `${openDay.expenses.length} discretionary ${openDay.expenses.length === 1 ? "expense" : "expenses"} • ${formatCurrency(openDay.spent, currency)} ${view === "payable" ? "payable" : "spent"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2">
            {openDay?.expenses
              .slice()
              .sort((a, b) => Number(b.amount) - Number(a.amount))
              .map((e) => {
                const cat = catById.get(e.category_id);
                const card = e.card_id ? cards.find((c) => c.id === e.card_id) : null;
                return (
                  <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.name || cat?.name || "Expense"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {cat?.name ?? "—"} · {e.payment_mode}
                        {card ? ` · ${card.name}` : ""}
                        {view === "payable" && e.date !== openDay.key ? ` · spent ${format(parseISO(e.date), "MMM d")}` : ""}
                      </div>
                      {e.note && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{e.note}</div>}
                    </div>
                    <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
                      {formatCurrency(Number(e.amount), currency)}
                    </div>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: "success" | "destructive" }) {
  return (
    <Card className="p-3.5 md:p-4 bg-card border-border">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className={cn(
        "mt-1.5 font-display text-lg md:text-xl font-bold tabular-nums truncate",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
      )}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>
    </Card>
  );
}

function NoBudgetState() {
  return (
    <div className="px-4 pt-10 pb-4 max-w-md mx-auto text-center">
      <div className="mx-auto size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Target className="size-6" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">Set a daily budget</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Define how much discretionary spend you allow per day, and Spendr will flag expensive vs. savings days for you.
      </p>
      <Link to="/settings" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
        Open Settings
      </Link>
    </div>
  );
}
