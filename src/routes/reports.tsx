import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useExpenses, useCategories, useProfile } from "@/lib/expense-queries";
import { formatCurrency, pctOfSalary } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { CategoryDot } from "@/components/category-dot";
import { SpendDonut } from "@/components/spend-donut";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, subMonths, startOfYear, format, parseISO,
} from "date-fns";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/reports")({
  component: () => <AppShell><ReportsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Reports — Spendr" }] }),
});

type RangeKey = "this_month" | "last_month" | "last_3" | "this_year" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3", label: "3 months" },
  { key: "this_year", label: "This year" },
  { key: "all", label: "All time" },
];

function rangeFor(key: RangeKey): { from?: Date; to?: Date; label: string; months: number } {
  const now = new Date();
  switch (key) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy"), months: 1 };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy"), months: 1 };
    }
    case "last_3":
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now), label: "Last 3 months", months: 3 };
    case "this_year":
      return { from: startOfYear(now), to: endOfMonth(now), label: format(now, "yyyy"), months: now.getMonth() + 1 };
    case "all":
      return { label: "All time", months: 1 };
  }
}

function ReportsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
  const range = rangeFor(rangeKey);
  const { data: expenses = [] } = useExpenses(user?.id, { from: range.from, to: range.to });
  const { data: trendExpenses = [] } = useExpenses(user?.id, { from: startOfMonth(subMonths(new Date(), 5)) });
  const currency = profile?.currency ?? "INR";
  const salary = profile?.monthly_salary ?? 0;

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, { amount: number; count: number }>();
    expenses.forEach((e) => {
      const cur = m.get(e.category_id) ?? { amount: 0, count: 0 };
      cur.amount += Number(e.amount);
      cur.count += 1;
      m.set(e.category_id, cur);
    });
    return Array.from(m.entries())
      .map(([id, v]) => {
        const c = categories.find((c) => c.id === id);
        return { id, name: c?.name ?? "Unknown", color: c?.color ?? "#888", type: c?.type ?? "WANT", amount: v.amount, count: v.count };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  const byMode = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.payment_mode, (m.get(e.payment_mode) ?? 0) + Number(e.amount)));
    const PALETTE: Record<string, string> = { UPI: "#3B82F6", CARD: "#F59E0B", CASH: "#10B981", NET_BANKING: "#8B5CF6", EMI: "#EF4444" };
    return Array.from(m.entries()).map(([id, amount]) => ({ id, name: id, amount, color: PALETTE[id] ?? "#888" }));
  }, [expenses]);

  const byType = useMemo(() => {
    const m: Record<string, number> = { NEED: 0, WANT: 0, EMI: 0, INVESTMENT: 0 };
    byCategory.forEach((c) => { m[c.type] = (m[c.type] ?? 0) + c.amount; });
    return m;
  }, [byCategory]);

  const monthlyTrend = useMemo(() => {
    const months: { label: string; key: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push({ label: format(d, "MMM"), key: format(d, "yyyy-MM"), amount: 0 });
    }
    trendExpenses.forEach((e) => {
      const k = format(parseISO(e.date), "yyyy-MM");
      const row = months.find((r) => r.key === k);
      if (row) row.amount += Number(e.amount);
    });
    return months;
  }, [trendExpenses]);

  if (!profile) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{range.label}</p>
        </div>
      </div>

      <div className="-mx-4 px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                rangeKey === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Total spent" value={formatCurrency(total, currency)} />
        <Stat label="Transactions" value={`${expenses.length}`} />
        <Stat label="% of salary" value={salary > 0 ? `${pctOfSalary(total, salary, range.months).toFixed(1)}%` : "—"} />
      </div>

      <Card className="p-4 md:p-5 bg-card border-border mb-4">
        <h2 className="font-display text-base font-semibold mb-3">Spend by category</h2>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No expenses in this range.</p>
        ) : (
          <>
            <div className="space-y-2.5 mb-2">
              {byCategory.map((c) => {
                const pct = total > 0 ? (c.amount / total) * 100 : 0;
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryDot color={c.color} icon="tag" size="sm" />
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">·{c.count}</span>
                      </div>
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="font-semibold">{formatCurrency(c.amount, currency)}</span>
                        <span className="text-[11px] text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card className="p-4 md:p-5 bg-card border-border">
          <h2 className="font-display text-base font-semibold mb-3">Payment mode</h2>
          {byMode.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">—</p>
          ) : (
            <SpendDonut data={byMode} centerLabel={formatCurrency(total, currency)} centerSub="total" currency={currency} />
          )}
        </Card>

        <Card className="p-4 md:p-5 bg-card border-border">
          <h2 className="font-display text-base font-semibold mb-3">NEED · WANT · EMI · INVESTMENT</h2>
          <div className="space-y-2.5">
            {(["NEED", "WANT", "EMI", "INVESTMENT"] as const).map((t) => {
              const amt = byType[t] ?? 0;
              const pct = total > 0 ? (amt / total) * 100 : 0;
              const colors: Record<string, string> = { NEED: "#3B82F6", WANT: "#F59E0B", EMI: "#EF4444", INVESTMENT: "#10B981" };
              return (
                <div key={t}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{t}</span>
                    <span className="tabular-nums"><span className="font-semibold">{formatCurrency(amt, currency)}</span> <span className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[t] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4 md:p-5 bg-card border-border">
        <h2 className="font-display text-base font-semibold mb-3">Monthly trend (last 6 months)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 md:p-4 bg-card border-border">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 font-display text-base md:text-lg font-bold tabular-nums truncate">{value}</div>
    </Card>
  );
}
