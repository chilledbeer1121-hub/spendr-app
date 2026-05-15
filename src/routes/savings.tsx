import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useSavings, useProfile } from "@/lib/expense-queries";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { PiggyBank, TrendingUp, Award } from "lucide-react";

export const Route = createFileRoute("/savings")({
  component: () => <AppShell><SavingsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Savings — Spendr" }] }),
});

function SavingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: savings = [] } = useSavings(user?.id);
  const currency = profile?.currency ?? "INR";

  const stats = useMemo(() => {
    const positive = savings.filter((s) => Number(s.amount_saved) > 0);
    const total = positive.reduce((s, r) => s + Number(r.amount_saved), 0);
    const avg = positive.length > 0 ? total / positive.length : 0;
    const best = positive.reduce<typeof savings[number] | null>((b, r) => (!b || Number(r.amount_saved) > Number(b.amount_saved) ? r : b), null);
    return { total, avg, best };
  }, [savings]);

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">Savings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Auto-tallied at the end of every month</p>
      </div>

      <Card className="p-5 bg-gradient-to-br from-primary/15 via-card to-card border-primary/30 mb-4">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <PiggyBank className="size-4" /> Total saved
        </div>
        <div className="mt-2 font-display text-3xl font-bold tabular-nums">{formatCurrency(stats.total, currency)}</div>
        <div className="text-xs text-muted-foreground mt-1">across {savings.filter((s) => Number(s.amount_saved) > 0).length} positive months</div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3.5 bg-card border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <TrendingUp className="size-3" /> Average / mo
          </div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums">{formatCurrency(stats.avg, currency)}</div>
        </Card>
        <Card className="p-3.5 bg-card border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <Award className="size-3" /> Best month
          </div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums">
            {stats.best ? formatCurrency(Number(stats.best.amount_saved), currency) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">{stats.best ? format(parseISO(stats.best.month), "MMM yyyy") : ""}</div>
        </Card>
      </div>

      {savings.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><PiggyBank className="size-6" /></div>
          <p className="mt-3 text-sm text-muted-foreground">No completed months yet. Come back at the end of the month.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border bg-card border-border">
          {savings.map((s) => {
            const saved = Number(s.amount_saved);
            const rate = Number(s.salary_snapshot) > 0 ? (saved / Number(s.salary_snapshot)) * 100 : 0;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{format(parseISO(s.month), "MMMM yyyy")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    Salary {formatCurrency(Number(s.salary_snapshot), currency)} · Spent {formatCurrency(Number(s.total_spent), currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold tabular-nums ${saved >= 0 ? "text-success" : "text-destructive"}`}>
                    {saved >= 0 ? "+" : ""}{formatCurrency(saved, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{rate.toFixed(0)}% rate</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
