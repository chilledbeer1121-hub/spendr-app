import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useExpenses, useCategories, useProfile, useCards,
} from "@/lib/expense-queries";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { CategoryDot } from "@/components/category-dot";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, subMonths, startOfYear, format, parseISO,
  eachDayOfInterval, getDay, addMonths,
} from "date-fns";
import {
  ResponsiveContainer, Treemap, Tooltip, Sankey, Layer, Rectangle,
} from "recharts";
import { useSpendView, filterByView, useIncludeRecurring, applyRecurringToggle } from "@/lib/payable";
import { SpendViewToggle } from "@/components/spend-view-toggle";

export const Route = createFileRoute("/visualization")({
  component: () => <AppShell><VizPage /></AppShell>,
  head: () => ({ meta: [{ title: "Visualization — Spendr" }] }),
});

type RangeKey = "this_month" | "last_month" | "last_3" | "this_year";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3", label: "3 months" },
  { key: "this_year", label: "This year" },
];

function rangeFor(key: RangeKey) {
  const now = new Date();
  switch (key) {
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") };
    case "last_month": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy") }; }
    case "last_3": return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now), label: "Last 3 months" };
    case "this_year": return { from: startOfYear(now), to: endOfMonth(now), label: format(now, "yyyy") };
  }
}

const TYPE_COLORS: Record<string, string> = {
  NEED: "#3B82F6", WANT: "#F59E0B", EMI: "#EF4444", INVESTMENT: "#10B981",
};

function VizPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
  const [view] = useSpendView();
  const [includeRec] = useIncludeRecurring();
  const range = rangeFor(rangeKey);
  const fetchFrom = startOfMonth(subMonths(range.from, 3));
  const fetchTo = endOfMonth(addMonths(range.to, 2));
  const { data: rawExpenses = [] } = useExpenses(user?.id, { from: fetchFrom, to: fetchTo });
  const currency = profile?.currency ?? "INR";

  const expenses = useMemo(
    () => filterByView(applyRecurringToggle(rawExpenses, includeRec), cards, view, range.from, range.to),
    [rawExpenses, cards, view, includeRec, range.from, range.to]
  );
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // === Treemap data: nested by Type → Category ===
  const treemapData = useMemo(() => {
    const byType: Record<string, { name: string; color: string; amount: number; children: { name: string; size: number; color: string }[] }> = {};
    expenses.forEach((e) => {
      const cat = categories.find((c) => c.id === e.category_id);
      if (!cat) return;
      const t = cat.type;
      if (!byType[t]) byType[t] = { name: t, color: TYPE_COLORS[t] ?? "#888", amount: 0, children: [] };
      byType[t].amount += Number(e.amount);
      const child = byType[t].children.find((x) => x.name === cat.name);
      if (child) child.size += Number(e.amount);
      else byType[t].children.push({ name: cat.name, size: Number(e.amount), color: cat.color });
    });
    return Object.values(byType).map((t) => ({
      name: t.name, color: t.color, children: t.children.sort((a, b) => b.size - a.size),
    }));
  }, [expenses, categories]);

  // === Sankey: Total Spend → Type → Top categories ===
  const sankeyData = useMemo(() => {
    const nodes: { name: string; color: string }[] = [{ name: "Total", color: "hsl(var(--primary))" }];
    const links: { source: number; target: number; value: number }[] = [];
    const typeAgg: Record<string, { amount: number; cats: Record<string, { amount: number; color: string }> }> = {};
    expenses.forEach((e) => {
      const cat = categories.find((c) => c.id === e.category_id);
      if (!cat) return;
      const t = cat.type;
      if (!typeAgg[t]) typeAgg[t] = { amount: 0, cats: {} };
      typeAgg[t].amount += Number(e.amount);
      const c = typeAgg[t].cats[cat.name] ?? { amount: 0, color: cat.color };
      c.amount += Number(e.amount); c.color = cat.color;
      typeAgg[t].cats[cat.name] = c;
    });
    Object.entries(typeAgg).forEach(([type, ta]) => {
      const typeIdx = nodes.length;
      nodes.push({ name: type, color: TYPE_COLORS[type] ?? "#888" });
      links.push({ source: 0, target: typeIdx, value: ta.amount });
      const topCats = Object.entries(ta.cats).sort((a, b) => b[1].amount - a[1].amount).slice(0, 6);
      topCats.forEach(([name, v]) => {
        const idx = nodes.length;
        nodes.push({ name, color: v.color });
        links.push({ source: typeIdx, target: idx, value: v.amount });
      });
    });
    return { nodes, links };
  }, [expenses, categories]);

  // === Calendar heatmap (daily totals in current range, capped to last 35 days) ===
  const heatmap = useMemo(() => {
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.date] = (map[e.date] ?? 0) + Number(e.amount); });
    const entries = days.map((d) => {
      const k = format(d, "yyyy-MM-dd");
      return { date: d, key: k, amount: map[k] ?? 0 };
    });
    const max = Math.max(1, ...entries.map((e) => e.amount));
    return { entries, max };
  }, [expenses, range.from, range.to]);

  // === Top transactions ===
  const topExpenses = useMemo(
    () => [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8),
    [expenses]
  );

  if (!profile) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Visualization</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {range.label} · {view === "payable" ? "Payable view" : "Spent view"} · {formatCurrency(total, currency)} total
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

      {expenses.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No expenses in this range yet. Add some to see your spending light up.
        </Card>
      ) : (
        <div className="grid gap-4">
          {/* Treemap */}
          <Card className="p-4 md:p-5 bg-card border-border">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-base font-semibold">Spend map</h2>
              <span className="text-[11px] text-muted-foreground">Size = amount · grouped by type</span>
            </div>
            <div className="h-72 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  stroke="hsl(var(--background))"
                  content={<TreemapTile />}
                  isAnimationActive={false}
                >
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      const value = p.size ?? p.value ?? 0;
                      const pct = total > 0 ? (value / total) * 100 : 0;
                      return (
                        <div className="rounded-md border border-border bg-card px-3 py-2 shadow text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="tabular-nums">{formatCurrency(value, currency)} · {pct.toFixed(1)}%</div>
                        </div>
                      );
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Sankey */}
          <Card className="p-4 md:p-5 bg-card border-border">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-base font-semibold">Money flow</h2>
              <span className="text-[11px] text-muted-foreground">Total → Type → Category</span>
            </div>
            <div className="h-80 md:h-96 overflow-x-auto">
              <div className="min-w-[560px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={sankeyData}
                    nodePadding={20}
                    nodeWidth={12}
                    linkCurvature={0.5}
                    iterations={32}
                    node={<SankeyNode />}
                    link={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.15 } as any}
                    margin={{ top: 10, bottom: 10, left: 10, right: 80 }}
                  >
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v), currency)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Calendar heatmap */}
          <Card className="p-4 md:p-5 bg-card border-border">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-base font-semibold">Daily heatmap</h2>
              <span className="text-[11px] text-muted-foreground">Darker = bigger day</span>
            </div>
            <CalendarHeatmap entries={heatmap.entries} max={heatmap.max} currency={currency} />
          </Card>

          {/* Type rings + Top expenses */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 md:p-5 bg-card border-border">
              <h2 className="font-display text-base font-semibold mb-4">Type breakdown</h2>
              <TypeBars treemapData={treemapData} total={total} currency={currency} />
            </Card>

            <Card className="p-4 md:p-5 bg-card border-border">
              <h2 className="font-display text-base font-semibold mb-3">Top transactions</h2>
              <div className="divide-y divide-border">
                {topExpenses.map((e) => {
                  const cat = categories.find((c) => c.id === e.category_id);
                  const pct = total > 0 ? (Number(e.amount) / total) * 100 : 0;
                  return (
                    <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryDot color={cat?.color ?? "#888"} icon="tag" size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{e.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {format(parseISO(e.date), "MMM d")} · {cat?.name ?? ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(e.amount), currency)}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function TreemapTile(props: any) {
  const { x, y, width, height, name, color, root, depth } = props;
  // Leaf nodes carry their own color; parent type tiles use their type color
  let fill = color ?? "#888";
  if (!color && root?.children && depth === 1) {
    const parent = root.children.find((c: any) => c.name === name);
    fill = parent?.color ?? "#888";
  }
  const showLabel = width > 60 && height > 26;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={fill}
        fillOpacity={depth === 1 ? 0.35 : 0.92}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      {showLabel && depth > 1 && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={600} className="pointer-events-none">
          {name}
        </text>
      )}
      {depth === 1 && width > 80 && height > 24 && (
        <text x={x + 6} y={y + 14} fill="hsl(var(--foreground))" fontSize={10} fontWeight={700} opacity={0.7} className="pointer-events-none uppercase tracking-wide">
          {name}
        </text>
      )}
    </g>
  );
}

function SankeyNode(props: any) {
  const { x, y, width, height, index, payload } = props;
  const color = payload?.color ?? "hsl(var(--primary))";
  const isLast = !payload?.targetLinks?.length || payload?.sourceLinks?.length === 0;
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} />
      <text
        x={isLast ? x + width + 6 : x - 6}
        y={y + height / 2}
        textAnchor={isLast ? "start" : "end"}
        dominantBaseline="middle"
        fontSize={11}
        fill="hsl(var(--foreground))"
      >
        {payload?.name}
      </text>
    </Layer>
  );
}

function CalendarHeatmap({ entries, max, currency }: { entries: { date: Date; key: string; amount: number }[]; max: number; currency: string }) {
  if (!entries.length) return null;
  // Build week columns starting Sun
  const first = entries[0].date;
  const leading = getDay(first); // 0..6
  const cells: ({ date: Date; key: string; amount: number } | null)[] = [
    ...Array(leading).fill(null),
    ...entries,
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="flex gap-2 overflow-x-auto">
      <div className="flex flex-col gap-1 pt-5 shrink-0">
        {dayLabels.map((d, i) => (
          <div key={i} className="h-4 text-[9px] text-muted-foreground leading-4 w-3">{d}</div>
        ))}
      </div>
      <div className="flex gap-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1 pt-5">
            {w.map((c, di) => {
              if (!c) return <div key={di} className="h-4 w-4" />;
              const intensity = c.amount / max;
              const bg = c.amount === 0 ? "hsl(var(--muted))" : `color-mix(in oklab, hsl(var(--primary)) ${Math.max(15, intensity * 100).toFixed(0)}%, hsl(var(--muted)))`;
              return (
                <div
                  key={di}
                  title={`${format(c.date, "MMM d")} · ${formatCurrency(c.amount, currency)}`}
                  className="h-4 w-4 rounded-sm"
                  style={{ background: bg }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 pl-3 ml-auto shrink-0">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {[0.15, 0.4, 0.65, 0.9].map((i) => (
          <div key={i} className="h-3 w-3 rounded-sm" style={{ background: `color-mix(in oklab, hsl(var(--primary)) ${i * 100}%, hsl(var(--muted)))` }} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

function TypeBars({ treemapData, total, currency }: { treemapData: { name: string; color: string; children: { size: number; name: string; color: string }[] }[]; total: number; currency: string }) {
  const rows = treemapData
    .map((t) => ({ name: t.name, color: t.color, amount: t.children.reduce((s, c) => s + c.size, 0), children: t.children }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const pct = total > 0 ? (r.amount / total) * 100 : 0;
        return (
          <div key={r.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: r.color }} />
                <span className="text-sm font-medium">{r.name}</span>
              </div>
              <div className="tabular-nums text-sm"><span className="font-semibold">{formatCurrency(r.amount, currency)}</span> <span className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</span></div>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {r.children.map((c, i) => {
                const w = r.amount > 0 ? (c.size / r.amount) * 100 : 0;
                return <div key={i} title={`${c.name} · ${formatCurrency(c.size, currency)}`} style={{ width: `${w}%`, background: c.color }} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
