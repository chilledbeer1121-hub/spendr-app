import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useExpenses, useCategories, useProfile, useCards } from "@/lib/expense-queries";
import { formatCurrency, pctOfSalary } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { CategoryDot } from "@/components/category-dot";
import { SpendDonut } from "@/components/spend-donut";
import { SpendViewToggle } from "@/components/spend-view-toggle";
import { useSpendView, filterByView, useIncludeRecurring, applyRecurringToggle } from "@/lib/payable";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import {
  startOfMonth, endOfMonth, subMonths, startOfYear, format, parseISO, addMonths,
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
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  const [spyFilter, setSpyFilter] = useState<string | null>(null);
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set());
  const toggleCat = (id: string) => setExcludedCats((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [view] = useSpendView();
  const [includeRec] = useIncludeRecurring();
  const range = rangeFor(rangeKey);
  // Widen the fetch window so "payable" view can pull card spends that fall due in/out of the range.
  const fetchFrom = range.from ? startOfMonth(subMonths(range.from, 3)) : undefined;
  const fetchTo = range.to ? endOfMonth(addMonths(range.to, 2)) : undefined;
  const { data: rawExpenses = [] } = useExpenses(user?.id, { from: fetchFrom, to: fetchTo });
  const { data: cards = [] } = useCards(user?.id);
  const { data: rawTrendExpenses = [] } = useExpenses(user?.id, { from: startOfMonth(subMonths(new Date(), 5)) });
  const currency = profile?.currency ?? "INR";
  const salary = profile?.monthly_salary ?? 0;

  const expenses = useMemo(() => {
    if (!range.from || !range.to) return applyRecurringToggle(rawExpenses, includeRec);
    return filterByView(applyRecurringToggle(rawExpenses, includeRec), cards, view, range.from, range.to);
  }, [rawExpenses, cards, view, includeRec, range.from, range.to]);
  const trendExpenses = useMemo(() => applyRecurringToggle(rawTrendExpenses, includeRec), [rawTrendExpenses, includeRec]);

  const includedExpenses = useMemo(
    () => expenses.filter((e) => !excludedCats.has(e.category_id)),
    [expenses, excludedCats],
  );
  const total = includedExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const excludedTotal = grandTotal - total;

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
    includedExpenses.forEach((e) => m.set(e.payment_mode, (m.get(e.payment_mode) ?? 0) + Number(e.amount)));
    const PALETTE: Record<string, string> = { UPI: "#3B82F6", CARD: "#F59E0B", CASH: "#10B981", NET_BANKING: "#8B5CF6", EMI: "#EF4444" };
    return Array.from(m.entries()).map(([id, amount]) => ({ id, name: id, amount, color: PALETTE[id] ?? "#888" }));
  }, [includedExpenses]);

  const byType = useMemo(() => {
    const m: Record<string, number> = { NEED: 0, WANT: 0, EMI: 0, INVESTMENT: 0 };
    byCategory.forEach((c) => {
      if (excludedCats.has(c.id)) return;
      m[c.type] = (m[c.type] ?? 0) + c.amount;
    });
    return m;
  }, [byCategory, excludedCats]);

  // Spy Mode aggregates
  const spy = useMemo(() => {
    const wantCats = new Set(categories.filter((c) => c.type === "WANT").map((c) => c.id));
    const needCats = new Set(categories.filter((c) => c.type === "NEED").map((c) => c.id));
    const wantItems = includedExpenses.filter((e) => (e.type_override ?? (wantCats.has(e.category_id) ? "WANT" : null)) === "WANT");
    const needItems = includedExpenses.filter((e) => (e.type_override ?? (needCats.has(e.category_id) ? "NEED" : null)) === "NEED");
    const big = includedExpenses.filter((e) => Number(e.amount) >= 1000);
    const small = includedExpenses.filter((e) => Number(e.amount) < 100);
    const weekendItems = includedExpenses.filter((e) => {
      const d = parseISO(e.date).getDay();
      return d === 0 || d === 6;
    });
    const nightItems = includedExpenses.filter((e) => {
      const d = parseISO(e.date).getHours();
      return d >= 22 || d < 5;
    });
    const cardItems = includedExpenses.filter((e) => e.payment_mode === "CARD");
    const cashItems = includedExpenses.filter((e) => e.payment_mode === "CASH");
    const byName = new Map<string, { count: number; amount: number }>();
    includedExpenses.forEach((e) => {
      const k = e.name.trim().toLowerCase();
      if (!k) return;
      const c = byName.get(k) ?? { count: 0, amount: 0 };
      c.count += 1; c.amount += Number(e.amount);
      byName.set(k, c);
    });
    const repeats = Array.from(byName.entries())
      .filter(([, v]) => v.count >= 3)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const sum = (arr: typeof includedExpenses) => arr.reduce((s, e) => s + Number(e.amount), 0);
    return {
      want: { count: wantItems.length, total: sum(wantItems) },
      need: { count: needItems.length, total: sum(needItems) },
      big: { count: big.length, total: sum(big) },
      small: { count: small.length, total: sum(small) },
      weekend: { count: weekendItems.length, total: sum(weekendItems) },
      card: { count: cardItems.length, total: sum(cardItems) },
      cash: { count: cashItems.length, total: sum(cashItems) },
      night: { count: nightItems.length, total: sum(nightItems) },
      repeats,
      avg: includedExpenses.length ? sum(includedExpenses) / includedExpenses.length : 0,
      max: includedExpenses.reduce((m, e) => (Number(e.amount) > m ? Number(e.amount) : m), 0),
    };
  }, [includedExpenses, categories]);

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
          <p className="text-xs text-muted-foreground mt-0.5">
            {range.label} · {view === "payable" ? "Payable view" : "Spent view"}
          </p>
        </div>
        <SpendViewToggle />
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

      <div className="grid grid-cols-3 gap-3 mb-2">
        <Stat label={excludedCats.size > 0 ? "Included total" : "Total spent"} value={formatCurrency(total, currency)} />
        <Stat label="Transactions" value={`${includedExpenses.length}`} />
        <Stat label="% of salary" value={salary > 0 ? `${pctOfSalary(total, salary, range.months).toFixed(1)}%` : "—"} />
      </div>
      {excludedCats.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Excluded {excludedCats.size} categor{excludedCats.size === 1 ? "y" : "ies"} · {formatCurrency(excludedTotal, currency)}
          </span>
          <button onClick={() => setExcludedCats(new Set())} className="font-medium text-primary hover:underline">
            Reset
          </button>
        </div>
      )}

      <Card className="p-4 md:p-5 bg-card border-border mb-4">
        <h2 className="font-display text-base font-semibold mb-3">Spend by category</h2>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No expenses in this range.</p>
        ) : (
          <>
            <div className="space-y-2.5 mb-2">
              {byCategory.map((c) => {
                const pct = grandTotal > 0 ? (c.amount / grandTotal) * 100 : 0;
                const excluded = excludedCats.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md -mx-1 px-1 py-1 transition-colors",
                      excluded && "opacity-50",
                    )}
                  >
                    <Checkbox
                      checked={!excluded}
                      onCheckedChange={() => toggleCat(c.id)}
                      aria-label={`Include ${c.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setDrillCategoryId(c.id)}
                      className="flex-1 min-w-0 text-left rounded-md px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
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
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Uncheck to exclude from totals · tap a row for details.</p>
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

      <Card className="mt-4 p-4 md:p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Spy Mode</h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">quick x-rays</span>
        </div>
        {includedExpenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No data in this range.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <SpyTile label="WANT spending" amount={spy.want.total} count={spy.want.count} currency={currency} accent="#F59E0B" hint={total > 0 ? `${((spy.want.total / total) * 100).toFixed(0)}% of total` : undefined} />
            <SpyTile label="NEED spending" amount={spy.need.total} count={spy.need.count} currency={currency} accent="#3B82F6" hint={total > 0 ? `${((spy.need.total / total) * 100).toFixed(0)}% of total` : undefined} />
            <SpyTile label="Over ₹1,000" amount={spy.big.total} count={spy.big.count} currency={currency} accent="#EF4444" hint={`${spy.big.count} txns`} />
            <SpyTile label="Under ₹100" amount={spy.small.total} count={spy.small.count} currency={currency} accent="#10B981" hint="small leaks" />
            <SpyTile label="Weekend spend" amount={spy.weekend.total} count={spy.weekend.count} currency={currency} accent="#8B5CF6" hint="Sat + Sun" />
            <SpyTile label="Late-night" amount={spy.night.total} count={spy.night.count} currency={currency} accent="#EC4899" hint="10pm–5am" />
            <SpyTile label="Card spend" amount={spy.card.total} count={spy.card.count} currency={currency} accent="#F59E0B" />
            <SpyTile label="Cash spend" amount={spy.cash.total} count={spy.cash.count} currency={currency} accent="#10B981" />
            <SpyTile label="Avg / txn" amount={spy.avg} currency={currency} accent="#6366F1" hint={`max ${formatCurrency(spy.max, currency)}`} />
          </div>
        )}
        {spy.repeats.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Repeat offenders (3+ times)</div>
            <div className="space-y-1.5">
              {spy.repeats.map((r) => (
                <div key={r.name} className="flex items-center justify-between text-sm">
                  <span className="truncate capitalize">{r.name} <span className="text-[10px] text-muted-foreground">×{r.count}</span></span>
                  <span className="tabular-nums font-semibold">{formatCurrency(r.amount, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>



      <Dialog open={!!drillCategoryId} onOpenChange={(o) => !o && setDrillCategoryId(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          {(() => {
            const cat = byCategory.find((c) => c.id === drillCategoryId);
            if (!cat) return null;
            const items = expenses
              .filter((e) => e.category_id === cat.id)
              .sort((a, b) => (a.date < b.date ? 1 : -1));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CategoryDot color={cat.color} icon="tag" size="sm" />
                    {cat.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-border">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
                    <div className="font-display text-base font-bold tabular-nums">{formatCurrency(cat.amount, currency)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">% of spend</div>
                    <div className="font-display text-base font-bold tabular-nums">{total > 0 ? ((cat.amount / total) * 100).toFixed(1) : "0"}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Count</div>
                    <div className="font-display text-base font-bold tabular-nums">{cat.count}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto -mx-6 px-6 divide-y divide-border">
                  {items.map((e) => {
                    const pct = cat.amount > 0 ? (Number(e.amount) / cat.amount) * 100 : 0;
                    return (
                      <div key={e.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{e.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {format(parseISO(e.date), "MMM d, yyyy")} · {e.payment_mode.replace("_", " ")}
                          </div>
                          {e.note && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{e.note}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold tabular-nums text-sm">{formatCurrency(Number(e.amount), currency)}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
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

function SpyTile({ label, amount, count, currency, accent, hint }: { label: string; amount: number; count?: number; currency: string; accent: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</span>
      </div>
      <div className="font-display text-sm md:text-base font-bold tabular-nums truncate">{formatCurrency(amount, currency)}</div>
      <div className="text-[10px] text-muted-foreground truncate">
        {count !== undefined && <>{count} txn{count === 1 ? "" : "s"}{hint ? " · " : ""}</>}
        {hint}
      </div>
    </div>
  );
}
