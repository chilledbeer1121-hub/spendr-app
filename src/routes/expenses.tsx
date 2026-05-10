import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useExpenses, useCategories, useProfile } from "@/lib/expense-queries";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { CategoryDot } from "@/components/category-dot";
import { AppShell } from "@/components/app-shell";
import { format, parseISO, startOfMonth } from "date-fns";

export const Route = createFileRoute("/expenses")({
  component: () => <AppShell><ExpensesPage /></AppShell>,
  head: () => ({ meta: [{ title: "Expenses — Spendr" }] }),
});

function ExpensesPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: expenses = [] } = useExpenses(user?.id, { from: startOfMonth(new Date()) });
  const { data: categories = [] } = useCategories(user?.id);
  const currency = profile?.currency ?? "INR";
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold">Expenses</h1>
        <Link to="/add" className="text-sm font-medium text-primary">+ Add</Link>
      </div>

      <Card className="p-4 mb-4 bg-card border-border">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">This month</div>
            <div className="font-display text-2xl font-bold tabular-nums">{formatCurrency(total, currency)}</div>
          </div>
          <div className="text-xs text-muted-foreground">{expenses.length} expenses</div>
        </div>
      </Card>

      {expenses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card border-border">
          Nothing here yet. <Link to="/add" className="text-primary font-medium">Log your first expense →</Link>
        </Card>
      ) : (
        <Card className="divide-y divide-border bg-card border-border">
          {expenses.map((e) => {
            const c = categories.find((c) => c.id === e.category_id);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryDot color={c?.color ?? "#64748b"} icon={c?.icon ?? "tag"} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(parseISO(e.date), "MMM d")} · {c?.name} · {e.payment_mode}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(e.amount), currency)}</div>
              </div>
            );
          })}
        </Card>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Filters, search, and date ranges coming next.
      </p>
    </div>
  );
}
