import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useExpenses, useCategories, useCards } from "@/lib/expense-queries";
import { formatCurrency, pctOfSalary, savingRate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryDot } from "@/components/category-dot";
import { SpendDonut } from "@/components/spend-donut";
import { AppShell } from "@/components/app-shell";
import { SpendViewToggle } from "@/components/spend-view-toggle";
import { useSpendView, filterByView, useIncludeRecurring, applyRecurringToggle, useIncludeInvestments, applyInvestmentToggle } from "@/lib/payable";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ArrowRight, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
  head: () => ({ meta: [{ title: "Dashboard — Spendr" }] }),
});

function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  // Pull a wider window so card expenses from previous months can be re-bucketed into "payable this month"
  const { data: rawExpenses = [] } = useExpenses(user?.id, {
    from: startOfMonth(subMonths(new Date(), 3)),
    to: endOfMonth(addMonths(new Date(), 1)),
  });
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const [view] = useSpendView();
  const [includeRec] = useIncludeRecurring();

  const salary = profile?.monthly_salary ?? 0;
  const currency = profile?.currency ?? "INR";
  const now = new Date();

  const expenses = useMemo(
    () => filterByView(applyRecurringToggle(rawExpenses, includeRec), cards, view, startOfMonth(now), endOfMonth(now)),
    [rawExpenses, cards, view, includeRec],
  );

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byCat = new Map<string, number>();
    expenses.forEach((e) => byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + Number(e.amount)));
    let biggestId: string | null = null;
    let biggestAmt = 0;
    byCat.forEach((v, k) => {
      if (v > biggestAmt) { biggestAmt = v; biggestId = k; }
    });
    const biggestCat = categories.find((c) => c.id === biggestId);
    return { total, remaining: Math.max(0, salary - total), biggestCat, biggestAmt, count: expenses.length, byCat };
  }, [expenses, categories, salary]);

  const donutData = useMemo(() => {
    return Array.from(stats.byCat.entries())
      .map(([id, amount]) => {
        const c = categories.find((c) => c.id === id);
        return c ? { id, name: c.name, amount, color: c.color } : null;
      })
      .filter(Boolean) as { id: string; name: string; amount: number; color: string }[];
  }, [stats.byCat, categories]);

  const recent = expenses.slice(0, 7);
  const monthName = format(new Date(), "MMMM");
  const spentPct = salary > 0 ? Math.min(100, (stats.total / salary) * 100) : 0;
  const spentLabel = view === "payable" ? "Payable this month" : "Spent this month";
  const remainingLabel = view === "payable" ? "After bills due" : "Remaining";

  if (!profile) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (salary === 0) return <NoSalaryState />;

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">{monthName}</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-0.5">
            Hey {profile?.name?.split(" ")[0] ?? "there"} <span className="inline-block">👋</span>
          </h1>
        </div>
        <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Take-home</span>{" "}
          <span className="font-semibold tabular-nums">{formatCurrency(salary, currency)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <SpendViewToggle />
        <span className="text-[11px] text-muted-foreground">
          {view === "payable" ? "Card spends counted on due date" : "Card spends counted on purchase date"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <SummaryCard label={spentLabel} value={formatCurrency(stats.total, currency)} sub={`${pctOfSalary(stats.total, salary).toFixed(1)}% of salary`} tone="default" />
        <SummaryCard label={remainingLabel} value={formatCurrency(stats.remaining, currency)} sub={`${savingRate(salary, stats.total).toFixed(0)}% saving rate`} tone="success" />
        <SummaryCard label="Biggest category" value={stats.biggestCat?.name ?? "—"} sub={stats.biggestAmt ? formatCurrency(stats.biggestAmt, currency) : "Nothing yet"} tone="default" />
        <SummaryCard label="Expenses" value={`${stats.count}`} sub={view === "payable" ? "due this month" : "this month"} tone="default" />
      </div>

      <Card className="mt-4 p-4 md:p-5 bg-card border-border">
        <div className="flex items-baseline justify-between text-sm mb-2">
          <span className="font-medium">Salary consumption</span>
          <span className="tabular-nums text-muted-foreground">{spentPct.toFixed(0)}% used</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${spentPct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatCurrency(stats.total, currency)} {view === "payable" ? "due" : "spent"}</span>
          <span>{formatCurrency(stats.remaining, currency)} left</span>
        </div>
      </Card>

      <Card className="mt-4 p-4 md:p-6 bg-card border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Where it's going</h2>
          <span className="text-xs text-muted-foreground">{donutData.length} categories</span>
        </div>
        {donutData.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No expenses yet this month.{" "}
            <Link to="/add" className="text-primary font-medium">Log your first one →</Link>
          </div>
        ) : (
          <SpendDonut data={donutData} centerLabel={formatCurrency(stats.total, currency)} centerSub={view === "payable" ? "due" : "spent"} currency={currency} />
        )}
      </Card>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-display text-lg font-semibold">Recent</h2>
          <Link to="/expenses" className="text-xs font-medium text-primary inline-flex items-center gap-1">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground bg-card border-border">
            No expenses yet. Tap <span className="text-primary font-medium">+</span> to add one.
          </Card>
        ) : (
          <Card className="divide-y divide-border bg-card border-border">
            {recent.map((e) => {
              const c = categories.find((c) => c.id === e.category_id);
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <CategoryDot color={c?.color ?? "#64748b"} icon={c?.icon ?? "tag"} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(parseISO(e.date), "MMM d")} · {e.payment_mode}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(e.amount), currency)}</div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "default" | "success" }) {
  return (
    <Card className="p-3.5 md:p-4 bg-card border-border">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`mt-1.5 font-display text-lg md:text-xl font-bold tabular-nums truncate ${tone === "success" ? "text-success" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>
    </Card>
  );
}

function NoSalaryState() {
  const nav = useNavigate();
  return (
    <div className="px-4 pt-10 pb-4 max-w-md mx-auto text-center">
      <div className="mx-auto size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Sparkles className="size-6" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">Welcome to Spendr</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        First, set your monthly take-home salary. Every percentage is calculated against it.
      </p>
      <Button className="mt-6" onClick={() => nav({ to: "/settings" })}>Set my salary</Button>
      <Button variant="outline" className="mt-3 ml-2" onClick={() => nav({ to: "/add" })}>
        <Plus className="size-4" /> Log expense anyway
      </Button>
    </div>
  );
}
