import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/cheat-meals")({
  component: () => (
    <AppShell>
      <CheatMealsPage />
    </AppShell>
  ),
  head: () => ({
    meta: [
      { title: "Cheat meals — Spendr" },
      { name: "description", content: "A simple monthly cheat meal budget: four a month, one tap to log, and a six month heatmap of how it trends." },
      { property: "og:title", content: "Cheat meals — Spendr" },
      { property: "og:description", content: "A simple monthly cheat meal budget: four a month, one tap to log, and a six month heatmap of how it trends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/* ---------- local-time date helpers (never toISOString) ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS: Record<string, string> = {
  "0": "Clean slate. Four in the budget.",
  "1": "3 left. Comfortable.",
  "2": "2 left. Halfway through the budget.",
  "3": "One left. Make it count.",
  "4": "Budget used. Resets on the 1st.",
};
const statusOver = (n: number) => `${n} over budget. Nothing's broken — the weekly average is what matters.`;

const PRESETS: { name: string; sub?: string; kcal: number }[] = [
  { name: "Vada pav", kcal: 300 },
  { name: "Momos", sub: "6 pc steamed", kcal: 250 },
  { name: "Samosa", sub: "1 pc", kcal: 260 },
  { name: "Pasta", sub: "restaurant", kcal: 800 },
  { name: "Biryani", sub: "1 plate", kcal: 700 },
  { name: "Pizza", sub: "2 slices", kcal: 550 },
  { name: "Burger", kcal: 500 },
  { name: "Fries", kcal: 350 },
  { name: "Ice cream", sub: "1 scoop", kcal: 200 },
  { name: "Mithai", sub: "1 pc", kcal: 150 },
  { name: "Cold drink", sub: "300 ml", kcal: 130 },
];

type Meal = { id: string; date: string; label: string; kcal: number };

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950";
const mono = "font-mono tabular-nums";

function CheatMealsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cKcal, setCKcal] = useState("");
  const [busy, setBusy] = useState(false);

  const today = new Date();
  const since = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const { data: meals = [] } = useQuery({
    queryKey: ["cheat-meals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cheat_meals")
        .select("id,date,label,kcal")
        .gte("date", localKey(since))
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meal[];
    },
  });

  const { data: budget = 4 } = useQuery({
    queryKey: ["cheat-meal-budget", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cheat_meal_settings")
        .select("monthly_budget")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.monthly_budget ?? 4;
    },
  });

  const monthPrefix = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const monthMeals = useMemo(() => meals.filter((m) => m.date.startsWith(monthPrefix)), [meals, monthPrefix]);
  const used = monthMeals.length;
  const remaining = budget - used;
  const over = used > budget;
  const kcalMonth = monthMeals.reduce((s, m) => s + (m.kcal || 0), 0);

  const daysSince = useMemo(() => {
    if (!meals.length) return null;
    const latest = meals.reduce((a, m) => (m.date > a ? m.date : a), meals[0].date);
    const diff = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - parseKey(latest).getTime()) / 86400000);
    return Math.max(0, diff);
  }, [meals]);

  async function log(label: string, kcal: number) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("cheat_meals").insert({
      user_id: user.id,
      date: localKey(new Date()),
      label,
      kcal,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cheat-meals", user.id] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("cheat_meals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cheat-meals", user?.id] });
  }

  const visiblePresets = expanded ? PRESETS : PRESETS.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10 text-stone-900 dark:text-stone-100">
      {/* 1. header */}
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cheat meals</h1>
        <span className="text-xs text-stone-500">{MONTHS_LONG[today.getMonth()]}</span>
      </header>

      {/* 2. budget meter */}
      <section className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-stone-200 p-5 dark:border-stone-800">
        <div className="flex items-baseline gap-2">
          <span className={cn(mono, "text-5xl font-medium leading-none sm:text-6xl", over && "text-amber-600 dark:text-amber-500")}>
            {over ? used : Math.max(0, remaining)}
          </span>
          <span className="text-sm text-stone-500">{over ? "logged" : `of ${budget} left`}</span>
        </div>
        <div className="flex items-end gap-1.5" aria-hidden="true">
          {Array.from({ length: budget }).map((_, i) => (
            <span
              key={i}
              className={cn("block h-10 w-1.5 rounded-full", i < used ? "bg-stone-800 dark:bg-stone-200" : "bg-stone-200 dark:bg-stone-800")}
            />
          ))}
          {over &&
            Array.from({ length: used - budget }).map((_, i) => (
              <span key={`o${i}`} className="block h-10 w-1.5 rounded-full bg-amber-500" />
            ))}
        </div>
      </section>

      {/* 3. status line */}
      <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
        {over ? statusOver(used - budget) : STATUS[String(Math.min(used, 4))]}
      </p>

      {/* 4. stats row */}
      <div className="mt-6 grid grid-cols-2 border-y border-stone-200 py-4 dark:border-stone-800">
        <div>
          <div className={cn(mono, "text-lg")}>{kcalMonth.toLocaleString("en-IN")}</div>
          <div className="text-xs text-stone-500">kcal this month</div>
        </div>
        <div>
          <div className={cn(mono, "text-lg")}>{daysSince === null ? "—" : daysSince}</div>
          <div className="text-xs text-stone-500">days since last</div>
        </div>
      </div>

      {/* 5. presets */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-2">
          {visiblePresets.map((p) => (
            <button
              key={p.name}
              type="button"
              disabled={busy}
              onClick={() => log(p.name, p.kcal)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-3 text-left transition active:scale-[0.98] hover:bg-stone-100 disabled:opacity-60 dark:border-stone-800 dark:hover:bg-stone-900",
                focus,
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{p.name}</span>
                {p.sub && <span className="block truncate text-xs text-stone-500">{p.sub}</span>}
              </span>
              <span className={cn(mono, "shrink-0 text-sm text-stone-500")}>{p.kcal}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          {PRESETS.length > 6 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className={cn("rounded text-xs text-stone-500 underline underline-offset-4", focus)}>
              {expanded ? "show less" : `${PRESETS.length - 6} more`}
            </button>
          )}
          <button type="button" onClick={() => setCustomOpen((v) => !v)} className={cn("rounded text-xs text-stone-500 underline underline-offset-4", focus)}>
            Something else
          </button>
        </div>

        {customOpen && (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const k = parseInt(cKcal, 10);
              if (!cName.trim() || !Number.isFinite(k)) return;
              log(cName.trim(), k);
              setCName("");
              setCKcal("");
            }}
          >
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="name"
              className={cn("min-w-0 flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm dark:border-stone-800", focus)}
            />
            <input
              value={cKcal}
              onChange={(e) => setCKcal(e.target.value)}
              inputMode="numeric"
              placeholder="kcal"
              className={cn("w-20 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm", mono, "dark:border-stone-800", focus)}
            />
            <button
              type="submit"
              className={cn("rounded-lg border border-stone-300 px-3 py-2 text-sm transition active:scale-[0.98] hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900", focus)}
            >
              Log
            </button>
          </form>
        )}
      </section>

      {/* 6. ledger */}
      {monthMeals.length > 0 && (
        <section className="mt-8">
          <ul className="border-t border-stone-200 dark:border-stone-800">
            {monthMeals.map((m) => {
              const d = parseKey(m.date);
              return (
                <li key={m.id} className="flex items-center gap-3 border-b border-stone-200 py-2.5 dark:border-stone-800">
                  <span className={cn(mono, "w-12 shrink-0 text-xs text-stone-500")}>{`${pad(d.getDate())}/${pad(d.getMonth() + 1)}`}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{m.label}</span>
                  <span className={cn(mono, "text-sm text-stone-500")}>{m.kcal}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${m.label}`}
                    onClick={() => remove(m.id)}
                    className={cn("rounded px-1 text-stone-400 transition hover:text-stone-900 active:scale-95 dark:hover:text-stone-100", focus)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 7. heatmap */}
      <Heatmap meals={meals} budget={budget} />
    </div>
  );
}

function Heatmap({ meals, budget }: { meals: Meal[]; budget: number }) {
  const today = new Date();
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of meals) m.set(x.date, (m.get(x.date) ?? 0) + (x.kcal || 0));
    return m;
  }, [meals]);

  const { weeks, monthLabels } = useMemo(() => {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // start: 26 weeks back, aligned to Monday
    const start = new Date(end);
    start.setDate(start.getDate() - 25 * 7);
    const dow = (start.getDay() + 6) % 7; // Mon=0
    start.setDate(start.getDate() - dow);

    const cols: Date[][] = [];
    const labels: { col: number; text: string }[] = [];
    const cursor = new Date(start);
    for (let c = 0; c < 26; c++) {
      const col: Date[] = [];
      for (let r = 0; r < 7; r++) {
        col.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      const firstOfMonth = col.find((d) => d.getDate() <= 7);
      if (firstOfMonth) {
        const text = MONTHS[firstOfMonth.getMonth()];
        if (!labels.length || labels[labels.length - 1].text !== text) labels.push({ col: c, text });
      }
      cols.push(col);
    }
    return { weeks: cols, monthLabels: labels };
  }, [meals]);

  const shade = (d: Date) => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d.getTime() > t.getTime()) return "bg-transparent";
    const k = byDay.get(localKey(d)) ?? 0;
    if (k === 0) return "bg-stone-150 bg-stone-200/60 dark:bg-stone-800/60";
    if (k <= 350) return "bg-stone-400 dark:bg-stone-600";
    if (k <= 700) return "bg-stone-600 dark:bg-stone-400";
    return "bg-stone-900 dark:bg-stone-100";
  };

  const monthTotals = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      out.push({ label: MONTHS[d.getMonth()], count: meals.filter((m) => m.date.startsWith(prefix)).length });
    }
    return out;
  }, [meals]);

  const rowLabels = ["M", "", "W", "", "F", "", "S"];

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-stone-600 dark:text-stone-400">Last 6 months</h2>
        <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
          <span>Lighter</span>
          <span className="size-2.5 rounded-sm bg-stone-200/60 dark:bg-stone-800/60" />
          <span className="size-2.5 rounded-sm bg-stone-400 dark:bg-stone-600" />
          <span className="size-2.5 rounded-sm bg-stone-900 dark:bg-stone-100" />
          <span>Heavier</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="inline-flex gap-1">
          <div className="mt-[14px] flex flex-col gap-[2px]">
            {rowLabels.map((l, i) => (
              <div key={i} className="flex h-[12px] w-3 items-center text-[8px] leading-none text-stone-400">
                {l}
              </div>
            ))}
          </div>
          <div>
            <div className="relative mb-0.5 h-3">
              {monthLabels.map((m) => (
                <span key={`${m.text}-${m.col}`} className="absolute top-0 text-[9px] text-stone-400" style={{ left: m.col * 14 }}>
                  {m.text}
                </span>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {weeks.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[2px]">
                  {col.map((d) => {
                    const kc = byDay.get(localKey(d)) ?? 0;
                    return (
                      <div
                        key={d.getTime()}
                        title={`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${kc} kcal`}
                        tabIndex={0}
                        className={cn("size-[12px] rounded-[3px]", shade(d), focus)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
        {monthTotals.map((m, i) => (
          <span key={m.label} className="flex items-center gap-2">
            <span>
              {m.label}{" "}
              <span className={cn(mono, m.count > budget ? "text-amber-600 dark:text-amber-500" : "text-stone-900 dark:text-stone-100")}>{m.count}</span>
            </span>
            {i < monthTotals.length - 1 && <span className="text-stone-300 dark:text-stone-700">·</span>}
          </span>
        ))}
      </div>
    </section>
  );
}
