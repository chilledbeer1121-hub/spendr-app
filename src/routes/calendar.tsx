import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useExpenses, useCategories, useProfile, useCards } from "@/lib/expense-queries";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpendViewToggle } from "@/components/spend-view-toggle";
import { CategoryDot } from "@/components/category-dot";
import { formatCurrency } from "@/lib/format";
import {
  useSpendView, filterByView, useIncludeRecurring, applyRecurringToggle,
  useIncludeInvestments, applyInvestmentToggle,
} from "@/lib/payable";
import {
  startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval,
  format, parseISO, getDay, isSameMonth, isToday, isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: () => <AppShell><CalendarPage /></AppShell>,
  head: () => ({ meta: [{ title: "Calendar — Spendr" }] }),
});

function CalendarPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const [anchor, setAnchor] = useState<Date>(startOfMonth(new Date()));
  const [view] = useSpendView();
  const [includeRec] = useIncludeRecurring();
  const [includeInv] = useIncludeInvestments();
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const monthFrom = startOfMonth(anchor);
  const monthTo = endOfMonth(anchor);
  const fetchFrom = startOfMonth(subMonths(monthFrom, 3));
  const fetchTo = endOfMonth(addMonths(monthTo, 2));
  const { data: rawExpenses = [] } = useExpenses(user?.id, { from: fetchFrom, to: fetchTo });
  const currency = profile?.currency ?? "INR";

  const expenses = useMemo(
    () => filterByView(
      applyInvestmentToggle(applyRecurringToggle(rawExpenses, includeRec), categories, includeInv),
      cards, view, monthFrom, monthTo,
    ),
    [rawExpenses, cards, categories, view, includeRec, includeInv, monthFrom, monthTo],
  );

  const perDay = useMemo(() => {
    const m = new Map<string, { total: number; items: typeof expenses }>();
    expenses.forEach((e) => {
      const key = e.date; // in "spent" mode = date; in "payable" filterByView already re-buckets card entries
      // For payable view we want to group by payable date visually:
      // filterByView doesn't rewrite dates, so recompute here.
      const cur = m.get(key) ?? { total: 0, items: [] as typeof expenses };
      cur.total += Number(e.amount);
      cur.items.push(e);
      m.set(key, cur);
    });
    return m;
  }, [expenses]);

  const days = eachDayOfInterval({ start: monthFrom, end: monthTo });
  const leading = getDay(monthFrom); // 0..6 (Sun)
  const cells: (Date | null)[] = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const activeDays = Array.from(perDay.values()).filter((d) => d.total > 0).length;
  const avg = activeDays > 0 ? monthTotal / activeDays : 0;
  const biggest = Array.from(perDay.entries()).sort((a, b) => b[1].total - a[1].total)[0];
  const maxDay = biggest?.[1].total ?? 0;

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const openItems = dayOpen ? perDay.get(dayOpen)?.items ?? [] : [];
  const openTotal = dayOpen ? perDay.get(dayOpen)?.total ?? 0 : 0;

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><CalendarDays className="size-6 text-primary" /> Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Day-wise spending · click any day to see the breakdown
          </p>
        </div>
        <SpendViewToggle />
      </div>

      <Card className="p-4 md:p-5 bg-card border-border">
        <div className="flex items-center justify-between mb-4 gap-2">
          <Button variant="ghost" size="icon" onClick={() => setAnchor(subMonths(anchor, 1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <div className="font-display text-lg font-bold">{format(anchor, "MMMM yyyy")}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {formatCurrency(monthTotal, currency)} across {activeDays} day{activeDays === 1 ? "" : "s"}
              {activeDays > 0 && <> · avg {formatCurrency(avg, currency)}/day</>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAnchor(startOfMonth(new Date()))}>Today</Button>
            <Button variant="ghost" size="icon" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {dayLabels.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((w, wi) => {
            const weekTotal = w.reduce((s, d) => {
              if (!d) return s;
              return s + (perDay.get(format(d, "yyyy-MM-dd"))?.total ?? 0);
            }, 0);
            return (
              <div key={wi} className="grid grid-cols-8 gap-1 items-stretch">
                <div className="col-span-7 grid grid-cols-7 gap-1">
                  {w.map((d, di) => {
                    if (!d) return <div key={di} className="aspect-square rounded-lg bg-transparent" />;
                    const key = format(d, "yyyy-MM-dd");
                    const bucket = perDay.get(key);
                    const total = bucket?.total ?? 0;
                    const inMonth = isSameMonth(d, anchor);
                    const today = isToday(d);

                    // Relative heat: 0 -> green, max -> red (HSL 140 → 0)
                    let bg: string | undefined;
                    const isFuture = isAfter(d, new Date());
                    if (inMonth && !isFuture) {
                      const ratio = maxDay > 0 ? total / maxDay : 0;
                      const hue = 140 - ratio * 140;
                      const sat = total === 0 ? 45 : 70;
                      const light = total === 0 ? 88 : 88 - ratio * 25;
                      bg = `hsl(${hue.toFixed(0)} ${sat}% ${light.toFixed(0)}%)`;
                    }

                    return (
                      <button
                        key={di}
                        onClick={() => total > 0 && setDayOpen(key)}
                        className={cn(
                          "group aspect-square rounded-lg border p-1.5 md:p-2 text-left transition-all flex flex-col justify-between",
                          inMonth ? "border-border/60" : "border-transparent opacity-40",
                          today ? "ring-2 ring-primary" : "",
                          total > 0 ? "hover:brightness-95 cursor-pointer" : "cursor-default",
                        )}
                        style={inMonth ? { background: bg } : undefined}
                        title={total > 0 ? `${format(d, "MMM d")} · ${formatCurrency(total, currency)}` : format(d, "MMM d")}
                      >
                        <div className="text-[10px] md:text-xs font-bold text-neutral-900">{format(d, "d")}</div>
                        {total > 0 && (
                          <div className="text-[9px] md:text-[11px] font-bold tabular-nums truncate text-neutral-900">
                            {formatCurrency(total, currency)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-dashed border-border p-1.5 md:p-2 flex flex-col justify-center items-end text-right">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Wk</div>
                  <div className="text-[10px] md:text-xs font-semibold tabular-nums">{formatCurrency(weekTotal, currency)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!dayOpen} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dayOpen ? format(parseISO(dayOpen), "EEE, MMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <span className="text-xs text-muted-foreground">{openItems.length} transaction{openItems.length === 1 ? "" : "s"}</span>
            <span className="font-display text-lg font-bold tabular-nums">{formatCurrency(openTotal, currency)}</span>
          </div>
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-border">
              {openItems.map((e) => {
                const cat = categories.find((c) => c.id === e.category_id);
                return (
                  <div key={e.id} className="py-2.5 flex items-center gap-3">
                    <CategoryDot color={cat?.color ?? "#888"} icon={cat?.icon ?? "tag"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground">{cat?.name ?? ""} · {e.payment_mode}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(e.amount), currency)}</div>
                  </div>
                );
              })}
              {openItems.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No transactions.</div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
