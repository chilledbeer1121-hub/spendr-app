import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/app-shell";
import { Lightbulb, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Target, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile, useCategories, useExpenses, useCards } from "@/lib/expense-queries";
import { formatCurrency } from "@/lib/format";
import { generateInsights, type InsightsResponse } from "@/lib/insights.functions";

function InsightsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<"this" | "last">("this");
  const [result, setResult] = useState<InsightsResponse | null>(null);

  const now = new Date();
  const monthStart = range === "this" ? startOfMonth(now) : startOfMonth(subMonths(now, 1));
  const monthEnd = range === "this" ? endOfMonth(now) : endOfMonth(subMonths(now, 1));
  const prevStart = startOfMonth(subMonths(monthStart, 1));
  const prevEnd = endOfMonth(subMonths(monthStart, 1));

  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const { data: expenses = [] } = useExpenses(user?.id, { from: prevStart, to: monthEnd });

  const callInsights = useServerFn(generateInsights);
  const mutation = useMutation({
    mutationFn: callInsights,
    onSuccess: (data) => setResult(data),
  });

  const summary = useMemo(() => {
    const inRange = expenses.filter((e) => e.date >= format(monthStart, "yyyy-MM-dd") && e.date <= format(monthEnd, "yyyy-MM-dd"));
    const prev = expenses.filter((e) => e.date >= format(prevStart, "yyyy-MM-dd") && e.date <= format(prevEnd, "yyyy-MM-dd"));
    const total = inRange.reduce((s, e) => s + Number(e.amount), 0);
    const prevTotal = prev.reduce((s, e) => s + Number(e.amount), 0);
    const days = Math.max(1, differenceInDays(now < monthEnd ? now : monthEnd, monthStart) + 1);

    const catMap = new Map<string, { name: string; type: string; amount: number; count: number }>();
    const typeMap: Record<string, number> = {};
    const modeMap: Record<string, number> = {};
    for (const e of inRange) {
      const cat = categories.find((c) => c.id === e.category_id);
      const key = cat?.id ?? "unknown";
      const agg = catMap.get(key) ?? { name: cat?.name ?? "Unknown", type: cat?.type ?? "WANT", amount: 0, count: 0 };
      agg.amount += Number(e.amount);
      agg.count += 1;
      catMap.set(key, agg);
      typeMap[cat?.type ?? "WANT"] = (typeMap[cat?.type ?? "WANT"] ?? 0) + Number(e.amount);
      modeMap[e.payment_mode] = (modeMap[e.payment_mode] ?? 0) + Number(e.amount);
    }
    const topCategories = [...catMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
    const recentBig = [...inRange]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((e) => ({
        name: e.name,
        amount: Number(e.amount),
        date: e.date,
        category: categories.find((c) => c.id === e.category_id)?.name ?? "Unknown",
      }));
    const cardOutstanding = cards.map((c) => {
      const outstanding = inRange
        .filter((e) => e.card_id === c.id && (!c.settled_until || e.date > c.settled_until))
        .reduce((s, e) => s + Number(e.amount), 0);
      return { name: c.name, outstanding };
    }).filter((c) => c.outstanding > 0);

    return {
      currency: profile?.currency ?? "INR",
      monthlySalary: Number(profile?.monthly_salary ?? 0),
      range: format(monthStart, "MMM yyyy"),
      totalSpent: total,
      txnCount: inRange.length,
      avgPerDay: total / days,
      topCategories,
      splitByType: typeMap,
      paymentModes: modeMap,
      cardOutstanding,
      recentBig,
      prevMonthTotal: prevTotal || null,
    };
  }, [expenses, categories, cards, profile, monthStart, monthEnd, prevStart, prevEnd, now]);

  const canAnalyze = summary.txnCount > 0;

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-24 md:px-8 md:pt-8 max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Sparkles className="size-6 text-primary" /> AI Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Smart, personalized analysis of your spending powered by AI.
            </p>
          </div>
          <Tabs value={range} onValueChange={(v) => { setRange(v as "this" | "last"); setResult(null); }}>
            <TabsList>
              <TabsTrigger value="this">This month</TabsTrigger>
              <TabsTrigger value="last">Last month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="p-5 bg-card border-border">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Spent" value={formatCurrency(summary.totalSpent, summary.currency)} />
            <Stat label="Transactions" value={summary.txnCount.toString()} />
            <Stat label="Avg/day" value={formatCurrency(summary.avgPerDay, summary.currency)} />
          </div>
          <Button
            className="w-full mt-5"
            size="lg"
            disabled={!canAnalyze || mutation.isPending}
            onClick={() => mutation.mutate({ data: summary })}
          >
            {mutation.isPending ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="size-4 mr-2" /> {result ? "Re-analyze" : "Analyze with AI"}</>
            )}
          </Button>
          {!canAnalyze && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              No expenses in this period yet — log some to unlock insights.
            </p>
          )}
          {mutation.isError && (
            <p className="text-xs text-destructive text-center mt-3">
              {(mutation.error as Error)?.message ?? "Something went wrong."}
            </p>
          )}
        </Card>

        {!result && !mutation.isPending && (
          <Card className="p-6 bg-card border-border text-center">
            <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Lightbulb className="size-6" />
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold">Ready when you are</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap "Analyze with AI" and we'll surface patterns, wins, warnings and actionable tips based on your real spending data.
            </p>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="p-5 bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30">
              <div className="flex items-start gap-3">
                <div className="size-10 shrink-0 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold leading-tight">{result.headline}</h2>
                  <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{result.summary}</p>
                </div>
              </div>
            </Card>

            <Section icon={<CheckCircle2 className="size-4" />} title="What went well" tone="success" items={result.positives} />
            <Section icon={<AlertTriangle className="size-4" />} title="Watch out" tone="warning" items={result.warnings} />
            <Section icon={<Target className="size-4" />} title="Suggestions" tone="primary" items={result.suggestions} />

            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <TrendingUp className="size-4 text-primary" /> Forecast
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.forecast}</p>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-base font-bold mt-1 truncate">{value}</div>
    </div>
  );
}

function Section({
  icon, title, tone, items,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "success" | "warning" | "primary";
  items: string[];
}) {
  if (!items?.length) return null;
  const toneCls =
    tone === "success" ? "text-emerald-500 bg-emerald-500/10" :
    tone === "warning" ? "text-amber-500 bg-amber-500/10" :
    "text-primary bg-primary/10";
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <span className={`size-7 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</span>
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/85 leading-relaxed flex gap-2">
            <span className="text-primary mt-1">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  head: () => ({ meta: [{ title: "AI Insights — Spendr" }] }),
});
